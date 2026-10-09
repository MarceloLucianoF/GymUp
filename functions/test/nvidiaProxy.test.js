"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createNvidiaProxyHandler } = require("../lib/nvidiaProxy");

const ORIGIN = "https://academyup.example";
const MODEL = "meta/llama-3.1-70b-instruct";

const response = () => {
  const res = { headers: {} };
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.send = (body) => { res.body = body; return res; };
  return res;
};

const request = ({
  method = "POST",
  origin = ORIGIN,
  authorization = "Bearer valid-token",
  body = { messages: [{ role: "user", content: "Olá" }] }
} = {}) => ({
  method,
  headers: { ...(origin ? { origin } : {}), ...(authorization ? { authorization } : {}) },
  body
});

const handlerFactory = (overrides = {}) => {
  const fetchCalls = [];
  const handler = createNvidiaProxyHandler({
    verifyIdToken: async () => ({ uid: "user-1" }),
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Resposta segura" } }] }) };
    },
    getApiKey: async () => "test-only-secret",
    allowedOrigins: [ORIGIN],
    timeoutMs: 50,
    now: () => 1000,
    logger: { warn() {}, error() {} },
    ...overrides
  });
  return { handler, fetchCalls };
};

test("CORS: permite somente preflight de origem configurada", async () => {
  const { handler } = handlerFactory();
  const allowed = response();
  await handler(request({ method: "OPTIONS", authorization: "" }), allowed);
  assert.equal(allowed.statusCode, 204);
  assert.equal(allowed.headers["Access-Control-Allow-Origin"], ORIGIN);
  assert.equal(allowed.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");

  const forbidden = response();
  await handler(request({ method: "OPTIONS", origin: "https://attacker.example" }), forbidden);
  assert.equal(forbidden.statusCode, 403);
  assert.deepEqual(forbidden.body, { error: "Origem não autorizada." });
});

test("rejeita autenticação ausente antes de acessar o provedor", async () => {
  const { handler, fetchCalls } = handlerFactory();
  const res = response();
  await handler(request({ authorization: "" }), res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Autenticação obrigatória." });
  assert.equal(fetchCalls.length, 0);
});

test("sanitiza token inválido", async () => {
  const { handler, fetchCalls } = handlerFactory({
    verifyIdToken: async () => { throw new Error("internal token detail"); }
  });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Sessão inválida ou expirada." });
  assert.equal(fetchCalls.length, 0);
});

test("rejeita apiKey e body fora do contrato", async () => {
  const { handler, fetchCalls } = handlerFactory();
  const res = response();
  await handler(request({ body: { messages: [{ role: "user", content: "Olá" }], apiKey: "client-value" } }), res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "A solicitação contém campos não permitidos." });
  assert.equal(fetchCalls.length, 0);
});

test("valida mensagens, modelo e max_tokens antes do fetch", async (t) => {
  const cases = [
    [{ messages: [] }, "Mensagens inválidas."],
    [{ messages: [{ role: "tool", content: "x" }] }, "Mensagens inválidas."],
    [{ messages: [{ role: "user", content: "x" }], model: "outside-allowlist" }, "Modelo não permitido."],
    [{ messages: [{ role: "user", content: "x" }], max_tokens: 0 }, "Limite de tokens inválido."],
    [{ messages: [{ role: "user", content: "x" }], max_tokens: 1201 }, "Limite de tokens inválido."],
    [{ messages: [{ role: "user", content: "x" }], max_tokens: 1.5 }, "Limite de tokens inválido."]
  ];
  for (const [body, error] of cases) {
    await t.test(error, async () => {
      const { handler, fetchCalls } = handlerFactory();
      const res = response();
      await handler(request({ body }), res);
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.body, { error });
      assert.equal(fetchCalls.length, 0);
    });
  }
});

test("retorna timeout sanitizado quando fetch é abortado", async () => {
  const { handler } = handlerFactory({
    timeoutMs: 1,
    fetchImpl: (_, options) => new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("network detail");
        error.name = "AbortError";
        reject(error);
      });
    })
  });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 504);
  assert.deepEqual(res.body, { error: "Tempo limite do provedor de IA excedido." });
});

test("sanitiza erros e respostas inválidas do upstream", async (t) => {
  const cases = [
    [async () => ({ ok: false, status: 401, json: async () => ({ error: "provider detail" }) }), "O provedor de IA não respondeu corretamente."],
    [async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) }), "Resposta inválida do provedor de IA."],
    [async () => { throw new Error("network detail"); }, "Não foi possível consultar o provedor de IA."]
  ];
  for (const [fetchImpl, error] of cases) {
    await t.test(error, async () => {
      const { handler } = handlerFactory({ fetchImpl });
      const res = response();
      await handler(request(), res);
      assert.equal(res.statusCode, 502);
      assert.deepEqual(res.body, { error });
    });
  }
});

test("encaminha somente payload validado no caminho autorizado", async () => {
  const { handler, fetchCalls } = handlerFactory();
  const res = response();
  await handler(request({
    body: { messages: [{ role: "user", content: "  Monte um treino  " }], model: MODEL, temperature: 0.3, max_tokens: 400 }
  }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { choices: [{ message: { role: "assistant", content: "Resposta segura" } }] });
  assert.equal(fetchCalls.length, 1);
  const [url, options] = fetchCalls[0];
  assert.equal(url, "https://integrate.api.nvidia.com/v1/chat/completions");
  assert.deepEqual(JSON.parse(options.body), {
    model: MODEL,
    messages: [{ role: "user", content: "Monte um treino" }],
    temperature: 0.3,
    max_tokens: 400
  });
  assert.ok(options.headers.Authorization.startsWith("Bearer "));
});

test("aplica rate limit por usuário sem fetch adicional", async () => {
  const { handler, fetchCalls } = handlerFactory();
  for (let index = 0; index < 20; index += 1) {
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 200);
  }
  const blocked = response();
  await handler(request(), blocked);
  assert.equal(blocked.statusCode, 429);
  assert.deepEqual(blocked.body, { error: "Limite temporário de solicitações excedido." });
  assert.equal(blocked.headers["Retry-After"], "60");
  assert.equal(fetchCalls.length, 20);
});
