import test from 'node:test';
import { A, ENV, api, assert, code, count, data, resetRateLimit, world } from './kit.js';
import { handleRequest } from '../src/index.js';

test.beforeEach(() => resetRateLimit());

test('health: público, sem banco, sem informação interna, com requestId', async () => {
  const r = await api(null, null, 'GET', '/v1/health');
  assert.equal(r.status, 200);
  assert.deepEqual(data(r), { status: 'ok', service: 'bohtreinar-academy-worker' });
  assert.ok(r.json.requestId);
  assert.ok(!JSON.stringify(r.json).includes('demo-gestao'));
});

test('token ausente, inválido, malformado e expirado: 401 sem consultar o banco nem vazar o motivo', async () => {
  const spy = { prepare: () => { throw new Error('não deveria consultar'); } };
  let r = await api(spy, null, 'GET', '/v1/me');
  assert.deepEqual([r.status, code(r)], [401, 'no_token']);
  r = await handleRequest(new Request('https://api.test/v1/me', { headers: { Authorization: 'Bearer lixo' } }), { ...ENV, DB: spy });   // verificação real
  assert.equal((await r.json()).error.code, 'invalid_token');
  r = await api(spy, 'u', 'GET', '/v1/me', { deps: { verify: async () => { throw new Error('Token expirado'); } } });
  assert.deepEqual([r.status, code(r)], [401, 'invalid_token']);
  assert.ok(!JSON.stringify(r.json).includes('expirado'));
});

test('usuário sem academia: listas vazias; academia inexistente e de outro: no_membership (não revela existência)', async () => {
  const d1 = world();
  assert.deepEqual(data(await api(d1, 'solto', 'GET', '/v1/me')).memberships, []);
  assert.deepEqual(data(await api(d1, 'solto', 'GET', '/v1/academies')).academies, []);
  assert.equal(code(await api(d1, 'solto', 'GET', `/v1/academies/${A}`)), 'no_membership');
  assert.equal(code(await api(d1, 'solto', 'GET', '/v1/academies/inexistente000000')), 'no_membership');
});

test('rotas: desconhecida 404, método errado 405, caminho com injeção ou id malformado nunca chega ao banco', async () => {
  const sql = [];
  const spy = { prepare: (s) => { sql.push(s); throw new Error('x'); } };
  for (const path of ['/outro', '/v1/colecao/users', '/v1/academies/..%2Fusers', "/v1/academies/x'%20OR%201=1--", '/v1/academies/a/b/c/d', '/v1/academies/' + 'a'.repeat(41)]) {
    assert.equal((await api(spy, 'u', 'GET', path)).status, 404, path);
  }
  assert.equal(code(await api(spy, 'u', 'DELETE', '/v1/me')), 'method_not_allowed');
  assert.equal(code(await api(spy, 'u', 'POST', '/v1/me', { body: {} })), 'method_not_allowed');
  assert.equal(code(await api(spy, 'u', 'GET', '/v1/invites/accept')), 'method_not_allowed');
  assert.equal(sql.length, 0);
});

test('CORS: origem desconhecida 403; permitida recebe cabeçalhos; OPTIONS 204 sem token', async () => {
  let r = await api(null, null, 'GET', '/v1/health', { headers: { Origin: 'https://malvado.example' } });
  assert.deepEqual([r.status, code(r)], [403, 'origin_not_allowed']);
  r = await api(null, null, 'GET', '/v1/health', { headers: { Origin: 'http://localhost:5174' } });
  assert.equal(r.res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5174');
  const pre = await handleRequest(new Request('https://api.test/v1/me', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5174' } }), ENV);
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('Access-Control-Allow-Methods'), /PATCH/);
});

test('rate limit: por usuário (121ª chamada), por IP e por academia só para quem tem vínculo', async () => {
  const d1 = world();
  const ip = { 'CF-Connecting-IP': '198.51.100.1' };
  let last;
  for (let i = 0; i < 121; i += 1) last = await api(d1, 'spam', 'GET', '/v1/me', { headers: ip });
  assert.equal(last.status, 429);
  assert.equal(last.res.headers.get('Retry-After'), '60');
  assert.equal((await api(d1, 'calmo', 'GET', '/v1/me', { headers: { 'CF-Connecting-IP': '203.0.113.9' } })).status, 200);   // outro usuário e IP seguem
  // por IP: muitos usuários diferentes no mesmo IP
  resetRateLimit();
  let r;
  for (let i = 0; i < 301; i += 1) r = await api(d1, `u${i}`, 'GET', '/v1/me', { headers: ip });
  assert.equal(r.status, 429);
  // um estranho não esgota o limite da academia de outra pessoa
  resetRateLimit();
  for (let i = 0; i < 40; i += 1) await api(d1, `estranho${i}`, 'GET', `/v1/academies/${A}`, { headers: { 'CF-Connecting-IP': `10.0.0.${i}` } });
  assert.equal((await api(d1, 'dono', 'GET', `/v1/academies/${A}`)).status, 200);
});

test('kill switch: escrita 503 sem tocar no banco; leitura segue; sair da academia continua funcionando', async () => {
  const d1 = world();
  const off = { ADMIN_OPS_ENABLED: 'false' };
  const before = count(d1, 'academies');
  const r = await api(d1, 'novo', 'POST', '/v1/academies', { body: { name: 'Nova' }, key: 'chave-ks-0001', env: off });
  assert.deepEqual([r.status, code(r)], [503, 'ops_disabled']);
  assert.equal(count(d1, 'academies'), before);
  assert.equal((await api(d1, 'dono', 'GET', '/v1/me', { env: off })).status, 200);
  assert.equal((await api(d1, 'alu', 'POST', `/v1/me/academies/${A}/leave`, { body: {}, env: off })).status, 200);
});

test('payload: grande demais (por cabeçalho e por bytes), não JSON e campo desconhecido são recusados', async () => {
  const d1 = world();
  const k = (s) => `chave-pl-${s}-0001`;
  assert.equal(code(await api(d1, 'novo', 'POST', '/v1/academies', { body: { name: 'x', pad: 'y'.repeat(9000) }, key: k('a') })), 'payload_too_large');
  assert.equal(code(await api(d1, 'novo', 'POST', '/v1/academies', { body: { name: 'Ã'.repeat(5000) }, key: k('b') })), 'payload_too_large');   // 10 KB em UTF-8 com 5000 caracteres
  assert.equal(code(await api(d1, 'novo', 'POST', '/v1/academies', { body: 'nao-json', key: k('c') })), 'invalid_request');
  assert.equal(code(await api(d1, 'novo', 'POST', '/v1/academies', { body: '[]', key: k('d') })), 'invalid_request');
  assert.equal(code(await api(d1, 'novo', 'POST', '/v1/academies', { body: { name: 'Ok', surprise: 1 }, key: k('e') })), 'invalid_request');
  assert.equal(count(d1, 'academies', "WHERE name LIKE 'Ok%'"), 0);
});

test('falha do banco: 502 genérico e sem detalhes internos', async () => {
  const broken = { prepare: () => ({ bind: () => ({ first: async () => { throw new Error('segredo interno do banco'); }, all: async () => { throw new Error('segredo interno do banco'); } }) }) };
  const r = await api(broken, 'u', 'GET', '/v1/me');
  assert.deepEqual([r.status, code(r)], [502, 'upstream_error']);
  assert.ok(!JSON.stringify(r.json).includes('segredo'));
});

test('convenção: o Worker nunca usa INSERT OR REPLACE, e nunca registra token, código de convite nem e-mail', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../src/', import.meta.url);
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) (f.isDirectory() ? walk(new URL(`${f.name}/`, d)) : files.push(new URL(f.name, d))); };
  walk(dir);
  assert.ok(files.length >= 10);
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!/OR REPLACE|REPLACE INTO/i.test(text), f.pathname);
    const logs = text.match(/console\.(log|error|warn|info)\([^)]*\)/g) || [];
    for (const l of logs) assert.ok(!/token|code\b|email|authorization|body/i.test(l.replace(/Violação do banco|Falha do banco|Falha inesperada|Rate limit durável/g, '')), l);
  }
});

// ---------- verificação REAL do ID token (assinatura RS256 com chave gerada no teste e JWKS injetado) ----------
const b64 = (obj) => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)).toString('base64url');
async function signer() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const sign = async (claims, { kid = 'k1', key = privateKey } = {}) => {
    const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
    const body = b64(claims);
    const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`))).toString('base64url');
    return `${head}.${body}.${sig}`;
  };
  const fetchImpl = async () => new Response(JSON.stringify({ keys: [jwk] }));
  return { sign, fetchImpl, other: (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign'])).privateKey };
}

test('token real: válido passa; expirado, audiência errada, emissor errado, assinatura de outra chave e kid desconhecido são 401 invalid_token', async () => {
  const { resetJwksCache } = await import('../../shared/firebaseAuth.js');
  resetJwksCache();
  const d1 = world();
  const { sign, fetchImpl, other } = await signer();
  const nowS = Math.floor(Date.parse('2026-10-14T12:00:00Z') / 1000);
  const base = { sub: 'dono', name: 'Dono', iat: nowS - 60, exp: nowS + 3600, aud: 'demo-gestao', iss: 'https://securetoken.google.com/demo-gestao' };
  const call = async (token) => {
    const res = await handleRequest(new Request('https://api.test/v1/me', { headers: { Authorization: `Bearer ${token}` } }), { ...ENV, DB: d1 }, { now: nowS * 1000, fetchImpl });
    return { status: res.status, json: await res.json() };
  };
  const ok = await call(await sign(base));
  assert.equal(ok.status, 200);
  assert.equal(ok.json.data.uid, 'dono');
  for (const [label, token] of [
    ['expirado', await sign({ ...base, exp: nowS - 3600 })],
    ['audiência errada', await sign({ ...base, aud: 'outro-projeto' })],
    ['emissor errado', await sign({ ...base, iss: 'https://securetoken.google.com/outro' })],
    ['sem sujeito', await sign({ ...base, sub: '' })],
    ['assinado por outra chave', await sign(base, { key: other })],
    ['kid desconhecido', await sign(base, { kid: 'k9' })],
    ['emitido no futuro', await sign({ ...base, iat: nowS + 7200 })]
  ]) {
    const r = await call(token);
    assert.deepEqual([label, r.status, r.json.error.code], [label, 401, 'invalid_token']);
  }
  const forged = (await sign(base)).split('.');
  forged[1] = b64({ ...base, sub: 'adm' });   // troca o uid mantendo a assinatura antiga
  assert.equal((await call(forged.join('.'))).status, 401);
});
