// Proxy autenticado para a API da NVIDIA (mesmas validações da Cloud Function em functions/lib).
import { verifyFirebaseIdToken } from './firebaseAuth.js';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'meta/llama-3.1-70b-instruct';
const ALLOWED_MODELS = new Set([
  DEFAULT_MODEL,
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'mistralai/mixtral-8x7b-instruct-v0.1'
]);
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const ALLOWED_BODY_FIELDS = new Set(['messages', 'model', 'temperature', 'max_tokens']);
const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT = { windowMs: 60_000, max: 20, maxEntries: 5000 };

const rateByUser = new Map();

export const resetRateLimit = () => rateByUser.clear();

const json = (status, payload, headers = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
});

export const normalizeMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 10) return null;
  let total = 0;
  const normalized = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
    if (!ALLOWED_ROLES.has(message.role) || typeof message.content !== 'string') return null;
    const content = message.content.trim();
    if (!content || content.length > 8000) return null;
    total += content.length;
    if (total > 24000) return null;
    normalized.push({ role: message.role, content });
  }
  return normalized;
};

// Limite por usuário em memória (por isolate: é um freio, não uma garantia global).
const allowRequest = (uid, now) => {
  if (rateByUser.size > RATE_LIMIT.maxEntries) {
    for (const [key, entry] of rateByUser) if (now - entry.start >= RATE_LIMIT.windowMs) rateByUser.delete(key);
  }
  const entry = rateByUser.get(uid);
  if (!entry || now - entry.start >= RATE_LIMIT.windowMs) {
    rateByUser.set(uid, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT.max) return false;
  entry.count += 1;
  return true;
};

export async function handleNvidiaRequest(request, env, deps = {}) {
  const { fetchImpl = fetch, now = Date.now(), verify = verifyFirebaseIdToken } = deps;
  const origin = request.headers.get('Origin');
  const sameOrigin = origin && origin === new URL(request.url).origin;
  const allowed = new Set(String(env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean));
  if (origin && !sameOrigin && !allowed.has(origin)) return json(403, { error: 'Origem não autorizada.' });

  const cors = origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin'
  } : {};

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' }, cors);

  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return json(401, { error: 'Autenticação obrigatória.' }, cors);

  let claims;
  try {
    claims = await verify(match[1], { projectId: env.FIREBASE_PROJECT_ID, fetchImpl, now });
  } catch {
    return json(401, { error: 'Sessão inválida ou expirada.' }, cors);
  }

  if (!allowRequest(claims.sub, now)) return json(429, { error: 'Limite temporário de solicitações excedido.' }, { ...cors, 'Retry-After': '60' });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Corpo da solicitação grande demais.' }, cors);
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'Corpo da solicitação inválido.' }, cors); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'Corpo da solicitação inválido.' }, cors);
  if (Object.keys(body).some((field) => !ALLOWED_BODY_FIELDS.has(field))) return json(400, { error: 'A solicitação contém campos não permitidos.' }, cors);

  const messages = normalizeMessages(body.messages);
  const model = body.model || DEFAULT_MODEL;
  const temperature = body.temperature === undefined ? 0.6 : body.temperature;
  const maxTokens = body.max_tokens === undefined ? 1000 : body.max_tokens;
  if (!messages) return json(400, { error: 'Mensagens inválidas.' }, cors);
  if (!ALLOWED_MODELS.has(model)) return json(400, { error: 'Modelo não permitido.' }, cors);
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 1) return json(400, { error: 'Temperatura inválida.' }, cors);
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 1200) return json(400, { error: 'Limite de tokens inválido.' }, cors);

  if (!env.NVIDIA_API_KEY) return json(503, { error: 'Serviço de IA indisponível.' }, cors);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const upstream = await fetchImpl(NVIDIA_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.NVIDIA_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens })
    });
    if (!upstream.ok) return json(502, { error: 'O provedor de IA não respondeu corretamente.' }, cors);
    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return json(502, { error: 'Resposta inválida do provedor de IA.' }, cors);
    return json(200, { choices: [{ message: { role: 'assistant', content: content.trim() } }] }, cors);
  } catch (error) {
    if (error?.name === 'AbortError') return json(504, { error: 'Tempo limite do provedor de IA excedido.' }, cors);
    return json(502, { error: 'Não foi possível consultar o provedor de IA.' }, cors);
  } finally {
    clearTimeout(timer);
  }
}
