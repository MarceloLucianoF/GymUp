"use strict";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";
const ALLOWED_MODELS = new Set([
  DEFAULT_MODEL,
  "nvidia/llama-3.1-nemotron-51b-instruct",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "nv-mistralai/mistral-nemo-12b-instruct",
  "google/gemma-3-12b-it"
]);
const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);
const ALLOWED_BODY_FIELDS = new Set(["messages", "model", "temperature", "max_tokens"]);

const setHeader = (res, name, value) => {
  if (typeof res.setHeader === "function") res.setHeader(name, value);
  else if (typeof res.set === "function") res.set(name, value);
};

const sendJson = (res, status, payload) => res.status(status).json(payload);

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 10) return null;

  let totalLength = 0;
  const normalized = [];
  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) return null;
    if (!ALLOWED_ROLES.has(message.role) || typeof message.content !== "string") return null;

    const content = message.content.trim();
    if (!content || content.length > 8000) return null;
    totalLength += content.length;
    if (totalLength > 24000) return null;
    normalized.push({ role: message.role, content });
  }
  return normalized;
};

const createNvidiaProxyHandler = ({
  verifyIdToken,
  fetchImpl,
  getApiKey,
  allowedOrigins = [],
  timeoutMs = 25000,
  now = () => Date.now(),
  logger = console
}) => {
  if (typeof verifyIdToken !== "function" || typeof fetchImpl !== "function" || typeof getApiKey !== "function") {
    throw new TypeError("Dependências obrigatórias do proxy não foram configuradas.");
  }

  const originAllowlist = new Set(allowedOrigins);
  const rateLimitByUser = new Map();

  return async (req, res) => {
    const origin = req.headers?.origin;
    if (origin && !originAllowlist.has(origin)) {
      return sendJson(res, 403, { error: "Origem não autorizada." });
    }

    setHeader(res, "Vary", "Origin");
    if (origin) setHeader(res, "Access-Control-Allow-Origin", origin);
    setHeader(res, "Access-Control-Allow-Methods", "POST, OPTIONS");
    setHeader(res, "Access-Control-Allow-Headers", "Authorization, Content-Type");
    setHeader(res, "Cache-Control", "no-store");

    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return sendJson(res, 405, { error: "Método não permitido." });

    const authorization = req.headers?.authorization || "";
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) return sendJson(res, 401, { error: "Autenticação obrigatória." });

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(tokenMatch[1]);
    } catch (error) {
      logger.warn?.("Token Firebase rejeitado no proxy de IA.");
      return sendJson(res, 401, { error: "Sessão inválida ou expirada." });
    }

    if (!decodedToken?.uid) return sendJson(res, 401, { error: "Sessão inválida ou expirada." });

    const currentTime = now();
    const previous = rateLimitByUser.get(decodedToken.uid);
    if (!previous || currentTime - previous.windowStartedAt >= 60000) {
      rateLimitByUser.set(decodedToken.uid, { windowStartedAt: currentTime, count: 1 });
    } else if (previous.count >= 20) {
      setHeader(res, "Retry-After", "60");
      return sendJson(res, 429, { error: "Limite temporário de solicitações excedido." });
    } else {
      previous.count += 1;
    }

    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(res, 400, { error: "Corpo da solicitação inválido." });
    }
    if (Object.keys(body).some((field) => !ALLOWED_BODY_FIELDS.has(field))) {
      return sendJson(res, 400, { error: "A solicitação contém campos não permitidos." });
    }

    const messages = normalizeMessages(body.messages);
    const model = body.model || DEFAULT_MODEL;
    const temperature = body.temperature === undefined ? 0.6 : body.temperature;
    const maxTokens = body.max_tokens === undefined ? 1000 : body.max_tokens;

    if (!messages) return sendJson(res, 400, { error: "Mensagens inválidas." });
    if (!ALLOWED_MODELS.has(model)) return sendJson(res, 400, { error: "Modelo não permitido." });
    if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
      return sendJson(res, 400, { error: "Temperatura inválida." });
    }
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 1200) {
      return sendJson(res, 400, { error: "Limite de tokens inválido." });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      logger.error?.("Secret NVIDIA_NIM_API_KEY não configurado.");
      return sendJson(res, 503, { error: "Serviço de IA indisponível." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetchImpl(NVIDIA_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens })
      });

      if (!upstream.ok) {
        logger.warn?.("Provedor de IA recusou a solicitação.", { status: upstream.status });
        return sendJson(res, 502, { error: "O provedor de IA não respondeu corretamente." });
      }

      const data = await upstream.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        return sendJson(res, 502, { error: "Resposta inválida do provedor de IA." });
      }

      return sendJson(res, 200, {
        choices: [{ message: { role: "assistant", content: content.trim() } }]
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return sendJson(res, 504, { error: "Tempo limite do provedor de IA excedido." });
      }
      logger.error?.("Falha interna no proxy de IA.", { name: error?.name || "Error" });
      return sendJson(res, 502, { error: "Não foi possível consultar o provedor de IA." });
    } finally {
      clearTimeout(timeout);
    }
  };
};

module.exports = { ALLOWED_MODELS, createNvidiaProxyHandler };
