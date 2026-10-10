import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFirebaseIdToken, resetJwksCache } from '../src/firebaseAuth.js';
import { handleNvidiaRequest, resetRateLimit, normalizeMessages } from '../src/nvidiaProxy.js';

const PROJECT = 'proj-teste';
const b64url = (input) => Buffer.from(input).toString('base64url');

async function makeSigner() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']
  );
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const sign = async (claims, header = { alg: 'RS256', kid: 'k1', typ: 'JWT' }) => {
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput));
    return `${signingInput}.${Buffer.from(signature).toString('base64url')}`;
  };
  const fetchImpl = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  return { sign, fetchImpl };
}

const goodClaims = (now, extra = {}) => ({
  iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: 'user-1',
  iat: Math.floor(now / 1000) - 10, exp: Math.floor(now / 1000) + 3600, ...extra
});

test('aceita token válido', async () => {
  resetJwksCache();
  const { sign, fetchImpl } = await makeSigner();
  const now = Date.now();
  const claims = await verifyFirebaseIdToken(await sign(goodClaims(now)), { projectId: PROJECT, fetchImpl, now });
  assert.equal(claims.sub, 'user-1');
});

test('rejeita expirado, audiência errada, emissor errado, alg none e assinatura adulterada', async () => {
  resetJwksCache();
  const { sign, fetchImpl } = await makeSigner();
  const now = Date.now();
  const opts = { projectId: PROJECT, fetchImpl, now };
  await assert.rejects(verifyFirebaseIdToken(await sign(goodClaims(now, { exp: Math.floor(now / 1000) - 600 })), opts), /expirado/);
  await assert.rejects(verifyFirebaseIdToken(await sign(goodClaims(now, { aud: 'outro' })), opts), /Audiência/);
  await assert.rejects(verifyFirebaseIdToken(await sign(goodClaims(now, { iss: 'https://evil' })), opts), /Emissor/);
  await assert.rejects(verifyFirebaseIdToken(await sign(goodClaims(now), { alg: 'none', kid: 'k1' }), opts), /Algoritmo/);
  const token = await sign(goodClaims(now));
  const tampered = `${token.split('.')[0]}.${b64url(JSON.stringify(goodClaims(now, { sub: 'admin' })))}.${token.split('.')[2]}`;
  await assert.rejects(verifyFirebaseIdToken(tampered, opts), /Assinatura/);
  await assert.rejects(verifyFirebaseIdToken('abc', opts), /malformado/);
});

const env = { FIREBASE_PROJECT_ID: PROJECT, NVIDIA_API_KEY: 'chave-de-teste', ALLOWED_ORIGINS: 'https://ok.example' };
const okVerify = async () => ({ sub: 'u1' });
const request = (body, headers = {}, method = 'POST') => new Request('https://app.example/api/nvidia', {
  method, headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json', ...headers }, body: method === 'POST' ? JSON.stringify(body) : undefined
});
const upstreamOk = async () => new Response(JSON.stringify({ choices: [{ message: { content: ' olá ' } }] }), { status: 200 });
const valid = { messages: [{ role: 'user', content: 'oi' }] };

test('proxy: sem token → 401; token inválido → 401', async () => {
  resetRateLimit();
  const noAuth = new Request('https://app.example/api/nvidia', { method: 'POST', body: '{}' });
  assert.equal((await handleNvidiaRequest(noAuth, env)).status, 401);
  const bad = await handleNvidiaRequest(request(valid), env, { verify: async () => { throw new Error('x'); } });
  assert.equal(bad.status, 401);
});

test('proxy: origem não autorizada → 403; origem permitida e mesma origem passam', async () => {
  resetRateLimit();
  assert.equal((await handleNvidiaRequest(request(valid, { Origin: 'https://evil.example' }), env, { verify: okVerify, fetchImpl: upstreamOk })).status, 403);
  assert.equal((await handleNvidiaRequest(request(valid, { Origin: 'https://ok.example' }), env, { verify: okVerify, fetchImpl: upstreamOk })).status, 200);
  assert.equal((await handleNvidiaRequest(request(valid, { Origin: 'https://app.example' }), env, { verify: okVerify, fetchImpl: upstreamOk })).status, 200);
});

test('proxy: validações de corpo', async () => {
  resetRateLimit();
  const call = (body) => handleNvidiaRequest(request(body), env, { verify: okVerify, fetchImpl: upstreamOk });
  assert.equal((await call({ ...valid, extra: 1 })).status, 400);
  assert.equal((await call({ messages: [] })).status, 400);
  assert.equal((await call({ ...valid, model: 'modelo/caro' })).status, 400);
  assert.equal((await call({ ...valid, temperature: 5 })).status, 400);
  assert.equal((await call({ ...valid, max_tokens: 99999 })).status, 400);
  assert.equal((await call({ messages: [{ role: 'tool', content: 'x' }] })).status, 400);
});

test('proxy: resposta normalizada e sem vazar a chave', async () => {
  resetRateLimit();
  let sentAuth;
  const res = await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl: async (url, init) => { sentAuth = init.headers.Authorization; return upstreamOk(); } });
  const text = await res.text();
  assert.equal(JSON.parse(text).choices[0].message.content, 'olá');
  assert.equal(sentAuth, 'Bearer chave-de-teste');
  assert.ok(!text.includes('chave-de-teste'));
});

test('proxy: erro do provedor vira 502 genérico; sem chave → 503; limite → 429', async () => {
  resetRateLimit();
  const failing = await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl: async () => new Response('segredo interno', { status: 500 }) });
  assert.equal(failing.status, 502);
  assert.ok(!(await failing.text()).includes('segredo'));
  assert.equal((await handleNvidiaRequest(request(valid), { ...env, NVIDIA_API_KEY: '' }, { verify: okVerify, fetchImpl: upstreamOk })).status, 503);
  resetRateLimit();
  let last;
  for (let i = 0; i < 21; i += 1) last = await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl: upstreamOk, now: 1_000_000 });
  assert.equal(last.status, 429);
});

test('normalizeMessages limita tamanho e quantidade', () => {
  assert.equal(normalizeMessages(Array.from({ length: 11 }, () => ({ role: 'user', content: 'a' }))), null);
  assert.equal(normalizeMessages([{ role: 'user', content: 'a'.repeat(8001) }]), null);
  assert.deepEqual(normalizeMessages([{ role: 'user', content: '  oi ' }]), [{ role: 'user', content: 'oi' }]);
});

// ---- modo 'auto': escolhe o primeiro modelo que a chave consegue chamar ----
import { resetModelCache } from '../src/nvidiaProxy.js';

const okBody = (text = 'ok') => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const statusOf = (code) => new Response('detalhe interno', { status: code });
const bodyModel = (init) => JSON.parse(init.body).model;

test('auto: pula modelos 404 e usa o primeiro que responde; devolve o modelo usado', async () => {
  resetRateLimit(); resetModelCache();
  const tried = [];
  const fetchImpl = async (url, init) => { tried.push(bodyModel(init)); return tried.length < 3 ? statusOf(404) : okBody('olá'); };
  const res = await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(tried.length, 3);
  assert.equal(data.model, tried[2]);
  assert.equal(data.choices[0].message.content, 'olá');
});

test('auto: lembra o último modelo que funcionou e começa por ele', async () => {
  resetRateLimit(); resetModelCache();
  let calls = [];
  const first = async (url, init) => { calls.push(bodyModel(init)); return calls.length < 2 ? statusOf(404) : okBody(); };
  await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl: first });
  const worked = calls[1];
  calls = [];
  await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl: async (url, init) => { calls.push(bodyModel(init)); return okBody(); } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0], worked);
});

test('auto: 401/403/429 interrompem (trocar de modelo não ajuda) e informam o status', async () => {
  for (const code of [401, 403, 429]) {
    resetRateLimit(); resetModelCache();
    let count = 0;
    const res = await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl: async () => { count += 1; return statusOf(code); } });
    const data = await res.json();
    assert.equal(res.status, 502);
    assert.equal(data.upstreamStatus, code);
    assert.equal(count, 1);
    assert.ok(!JSON.stringify(data).includes('detalhe interno'));
  }
});

test('auto: todos os modelos indisponíveis → 502 com upstreamStatus 404 e no máximo 8 tentativas', async () => {
  resetRateLimit(); resetModelCache();
  let count = 0;
  const res = await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl: async () => { count += 1; return statusOf(404); } });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).upstreamStatus, 404);
  assert.ok(count <= 8);
});

test('auto: resposta vazia (modelo de raciocínio) passa para o próximo', async () => {
  resetRateLimit(); resetModelCache();
  let count = 0;
  const empty = new Response(JSON.stringify({ choices: [{ message: { content: null } }] }), { status: 200 });
  const res = await handleNvidiaRequest(request(valid), env, { verify: okVerify, fetchImpl: async () => { count += 1; return count === 1 ? empty : okBody('texto'); } });
  assert.equal(res.status, 200);
  assert.equal(count, 2);
});

test('modelo explícito: 404 não tenta outros modelos', async () => {
  resetRateLimit(); resetModelCache();
  let count = 0;
  const res = await handleNvidiaRequest(request({ ...valid, model: 'google/gemma-3-12b-it' }), env, { verify: okVerify, fetchImpl: async () => { count += 1; return statusOf(404); } });
  assert.equal(res.status, 502);
  assert.equal(count, 1);
});
