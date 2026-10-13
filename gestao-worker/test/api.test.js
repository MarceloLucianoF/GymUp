import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, resetRateLimit } from '../src/index.js';

const ENV = { FIREBASE_PROJECT_ID: 'demo-gestao', ALLOWED_ORIGINS: 'http://localhost:5174', ADMIN_OPS_ENABLED: 'true' };
const A = 'academiaaaaaaaaaaaa';
const B = 'academiabbbbbbbbbbbb';

// tipo -> valor do Firestore REST
const val = (v) => (typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : v && typeof v === 'object' ? { mapValue: { fields: fields(v) } } : { nullValue: null });
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));
const docOf = (col, id, data) => ({ name: `projects/demo-gestao/databases/(default)/documents/${col}/${id}`, fields: fields(data) });

const member = (aid, uid, role, status = 'active', extra = {}) => ({ academyId: aid, userId: uid, role, status, displayName: `Nome ${uid}`, consent: { adherence: true }, ...extra });

// Banco falso que aplica a mesma ideia das regras: só devolve o que o teste liberar para aquele uid.
function makeDb({ members = [], academies = {}, deny = new Set() } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), auth: init.headers?.Authorization });
    const u = String(url);
    if (u.endsWith(':runQuery')) {
      const q = JSON.parse(init.body).structuredQuery;
      const f = q.where.fieldFilter;
      const rows = members.filter((m) => m[f.field.fieldPath] === f.value.stringValue);
      if (deny.has('query')) return new Response('{}', { status: 403 });
      return new Response(JSON.stringify(rows.length ? rows.map((m) => ({ document: docOf('academyMembers', `${m.academyId}_${m.userId}`, m) })) : [{ readTime: 'x' }]), { status: 200 });
    }
    const [, col, id] = u.match(/documents\/([A-Za-z]+)\/([^?]+)$/);
    if (col === 'academyMembers') {
      const m = members.find((x) => `${x.academyId}_${x.userId}` === id);
      return m ? new Response(JSON.stringify(docOf(col, id, m)), { status: 200 }) : new Response('{}', { status: 404 });
    }
    if (col === 'academies') {
      const a = academies[id];
      if (!a || a.status !== 'active') return new Response('{}', { status: 403 });   // as regras negam academia suspensa
      return new Response(JSON.stringify(docOf(col, id, a)), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  return { fetchImpl, calls };
}

const verifyAs = (uid) => async () => ({ sub: uid, email: `${uid}@example.invalid` });
const req = (path, { token = 'tok', method = 'GET', origin, headers = {}, body } = {}) =>
  new Request(`https://api.test${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}), ...headers }, body });
const call = async (r, deps = {}, env = ENV) => { const res = await handleRequest(r, env, { now: 1_000_000, ...deps }); return { res, json: await res.json().catch(() => null) }; };

test.beforeEach(() => resetRateLimit());

test('health é público, não toca no banco e traz requestId', async () => {
  const db = makeDb();
  const { res, json } = await call(req('/v1/health', { token: null }), { fetchImpl: db.fetchImpl });
  assert.equal(res.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.data.status, 'ok');
  assert.ok(json.requestId);
  assert.equal(db.calls.length, 0);
});

test('sem token: 401 no_token', async () => {
  const { res, json } = await call(req('/v1/me', { token: null }));
  assert.equal(res.status, 401);
  assert.equal(json.error.code, 'no_token');
  assert.equal(json.ok, false);
  assert.ok(json.requestId);
});

test('token inválido, malformado ou expirado: 401 invalid_token, sem consultar o banco', async () => {
  const db = makeDb();
  // verificação real: token malformado
  let r = await call(req('/v1/me', { token: 'lixo' }), { fetchImpl: db.fetchImpl });
  assert.equal(r.res.status, 401);
  assert.equal(r.json.error.code, 'invalid_token');
  // expirado/assinatura ruim: o verificador lança
  r = await call(req('/v1/me'), { fetchImpl: db.fetchImpl, verify: async () => { throw new Error('Token expirado'); } });
  assert.equal(r.json.error.code, 'invalid_token');
  assert.equal(db.calls.length, 0);
  assert.ok(!JSON.stringify(r.json).includes('expirado'), 'não vaza o motivo interno');
});

test('usuário sem academia: /me devolve lista vazia', async () => {
  const db = makeDb({ members: [member(A, 'outro', 'owner')] });
  const { res, json } = await call(req('/v1/me'), { fetchImpl: db.fetchImpl, verify: verifyAs('solto') });
  assert.equal(res.status, 200);
  assert.deepEqual(json.data.memberships, []);
  assert.equal(json.data.uid, 'solto');
});

test('/me lista vínculos com papéis diferentes em academias diferentes e usa o token do próprio usuário', async () => {
  const db = makeDb({
    members: [member(A, 'u1', 'student'), member(B, 'u1', 'owner'), member(A, 'u2', 'owner')],
    academies: { [A]: { name: 'Academia A', status: 'active' }, [B]: { name: 'Academia B', status: 'active' } }
  });
  const { json } = await call(req('/v1/me', { token: 'tok-u1' }), { fetchImpl: db.fetchImpl, verify: verifyAs('u1') });
  const byId = Object.fromEntries(json.data.memberships.map((m) => [m.academyId, m]));
  assert.equal(byId[A].role, 'student');
  assert.equal(byId[B].role, 'owner');
  assert.equal(byId[B].academy.name, 'Academia B');
  assert.equal(json.data.memberships.length, 2);
  assert.ok(db.calls.every((c) => c.auth === 'Bearer tok-u1'), 'todas as leituras usam o token do usuário (regras valem)');
});

test('/me: academia suspensa aparece sem dados da academia', async () => {
  const db = makeDb({ members: [member(A, 'u1', 'owner')], academies: { [A]: { name: 'A', status: 'suspended' } } });
  const { json } = await call(req('/v1/me'), { fetchImpl: db.fetchImpl, verify: verifyAs('u1') });
  assert.equal(json.data.memberships[0].academy, null);
});

test('academia: membro ativo lê; sem vínculo, vínculo inativo e academia suspensa são 403 distintos', async () => {
  const db = makeDb({
    members: [member(A, 'aluno', 'student'), member(A, 'susp', 'teacher', 'suspended'), member(B, 'dono', 'owner')],
    academies: { [A]: { name: 'A', status: 'active' }, [B]: { name: 'B', status: 'suspended' } }
  });
  const get = (uid, id) => call(req(`/v1/academies/${id}`), { fetchImpl: db.fetchImpl, verify: verifyAs(uid) });
  let r = await get('aluno', A);
  assert.equal(r.res.status, 200);
  assert.deepEqual(r.json.data, { academyId: A, name: 'A', status: 'active', myRole: 'student' });
  r = await get('estranho', A);
  assert.equal(r.json.error.code, 'no_membership');
  assert.equal(r.res.status, 403);
  r = await get('susp', A);
  assert.equal(r.json.error.code, 'membership_inactive');
  r = await get('dono', B);
  assert.equal(r.json.error.code, 'academy_unavailable');
});

test('isolamento: dono da academia A não alcança a B', async () => {
  const db = makeDb({ members: [member(A, 'donoA', 'owner'), member(B, 'donoB', 'owner')], academies: { [A]: { name: 'A', status: 'active' }, [B]: { name: 'B', status: 'active' } } });
  for (const path of [`/v1/academies/${B}`, `/v1/academies/${B}/members`]) {
    const { json } = await call(req(path), { fetchImpl: db.fetchImpl, verify: verifyAs('donoA') });
    assert.equal(json.error.code, 'no_membership');
  }
});

test('membros: só dono e admin; professor, recepção e aluno recebem forbidden_role', async () => {
  const db = makeDb({
    members: [member(A, 'dono', 'owner'), member(A, 'adm', 'admin'), member(A, 'prof', 'teacher'), member(A, 'rec', 'reception'), member(A, 'alu', 'student')],
    academies: { [A]: { name: 'A', status: 'active' } }
  });
  for (const uid of ['prof', 'rec', 'alu']) {
    const { res, json } = await call(req(`/v1/academies/${A}/members`), { fetchImpl: db.fetchImpl, verify: verifyAs(uid) });
    assert.equal(res.status, 403, uid);
    assert.equal(json.error.code, 'forbidden_role', uid);
  }
  for (const uid of ['dono', 'adm']) {
    const { res, json } = await call(req(`/v1/academies/${A}/members`), { fetchImpl: db.fetchImpl, verify: verifyAs(uid) });
    assert.equal(res.status, 200, uid);
    assert.equal(json.data.members.length, 5);
    assert.ok(!JSON.stringify(json).includes('consent'), 'não expõe consentimento nem dados de saúde');
    assert.deepEqual(Object.keys(json.data.members[0]).sort(), ['displayName', 'role', 'status', 'userId']);
  }
});

test('papel e academia enviados pelo cliente não valem: query string e cabeçalhos são ignorados', async () => {
  const db = makeDb({ members: [member(A, 'alu', 'student')], academies: { [A]: { name: 'A', status: 'active' } } });
  const { res, json } = await call(req(`/v1/academies/${A}/members?role=owner&userId=alu`, { headers: { 'X-Role': 'owner', 'X-Academy-Id': A } }), { fetchImpl: db.fetchImpl, verify: verifyAs('alu') });
  assert.equal(res.status, 403);
  assert.equal(json.error.code, 'forbidden_role');
});

test('vínculo com campos divergentes do ID é recusado', async () => {
  const forged = member(B, 'alu', 'owner');   // documento A_alu dizendo ser da B
  const db = makeDb({ members: [{ ...forged, academyId: B }], academies: { [B]: { name: 'B', status: 'active' } } });
  const fetchImpl = async (url, init) => (String(url).endsWith(`academyMembers/${A}_alu`)
    ? new Response(JSON.stringify(docOf('academyMembers', `${A}_alu`, forged)), { status: 200 }) : db.fetchImpl(url, init));
  const { json } = await call(req(`/v1/academies/${A}`), { fetchImpl, verify: verifyAs('alu') });
  assert.equal(json.error.code, 'no_membership');
});

test('caminho arbitrário, id inválido e método errado nunca chegam ao banco', async () => {
  const db = makeDb();
  const run = (path, opts) => call(req(path, opts), { fetchImpl: db.fetchImpl, verify: verifyAs('u') });
  assert.equal((await run('/v1/academies/..%2Fusers')).res.status, 404);
  assert.equal((await run('/v1/academies/a/b/c')).res.status, 404);
  assert.equal((await run('/v1/colecao/users')).res.status, 404);
  assert.equal((await run('/outro')).res.status, 404);
  assert.equal((await run('/v1/me', { method: 'POST' })).json.error.code, 'method_not_allowed');
  assert.equal(db.calls.length, 0);
});

test('kill switch: com ADMIN_OPS_ENABLED desligado qualquer escrita é 503, leituras seguem', async () => {
  const off = { ...ENV, ADMIN_OPS_ENABLED: 'false' };
  const db = makeDb();
  let r = await call(req('/v1/me', { method: 'POST', body: '{}' }), { fetchImpl: db.fetchImpl, verify: verifyAs('u') }, off);
  assert.equal(r.res.status, 503);
  assert.equal(r.json.error.code, 'ops_disabled');
  assert.equal(db.calls.length, 0);
  r = await call(req('/v1/health', { token: null }), {}, off);
  assert.equal(r.res.status, 200);
});

test('CORS: origem desconhecida é 403; origem permitida recebe os cabeçalhos; OPTIONS responde 204', async () => {
  let r = await call(req('/v1/health', { token: null, origin: 'https://malvado.example' }));
  assert.equal(r.res.status, 403);
  assert.equal(r.json.error.code, 'origin_not_allowed');
  r = await call(req('/v1/health', { token: null, origin: 'http://localhost:5174' }));
  assert.equal(r.res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5174');
  const pre = await handleRequest(req('/v1/me', { token: null, method: 'OPTIONS', origin: 'http://localhost:5174' }), ENV);
  assert.equal(pre.status, 204);
});

test('rate limit por usuário: a 61ª chamada no minuto é 429 com Retry-After', async () => {
  const db = makeDb();
  let last;
  for (let i = 0; i < 61; i += 1) last = await call(req('/v1/me', { headers: { 'CF-Connecting-IP': '198.51.100.1' } }), { fetchImpl: db.fetchImpl, verify: verifyAs('spam') });
  assert.equal(last.res.status, 429);
  assert.equal(last.json.error.code, 'rate_limited');
  assert.equal(last.res.headers.get('Retry-After'), '60');
  const other = await call(req('/v1/me', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }), { fetchImpl: db.fetchImpl, verify: verifyAs('calmo') });
  assert.equal(other.res.status, 200);
});

test('falha do Firestore: 502 genérico, sem detalhes internos', async () => {
  const fetchImpl = async () => new Response('segredo interno', { status: 500 });
  const { res, json } = await call(req('/v1/me'), { fetchImpl, verify: verifyAs('u') });
  assert.equal(res.status, 502);
  assert.equal(json.error.code, 'upstream_error');
  assert.ok(!JSON.stringify(json).includes('segredo'));
});

test('health não expõe o projeto; vínculo com academyId inválido é ignorado no /me', async () => {
  const { json } = await call(req('/v1/health', { token: null }));
  assert.equal(json.data.env, undefined);
  const db = makeDb({ members: [member('../x', 'u1', 'owner'), member(A, 'u1', 'owner')], academies: { [A]: { name: 'A', status: 'active' } } });
  const r = await call(req('/v1/me'), { fetchImpl: db.fetchImpl, verify: verifyAs('u1') });
  assert.equal(r.res.status, 200);
  assert.deepEqual(r.json.data.memberships.map((m) => m.academyId), [A]);
});

test('um estranho não consome o limite da academia de outra pessoa', async () => {
  const db = makeDb({ members: [member(A, 'dono', 'owner')], academies: { [A]: { name: 'A', status: 'active' } } });
  for (let i = 0; i < 40; i += 1) await call(req(`/v1/academies/${A}`), { fetchImpl: db.fetchImpl, verify: verifyAs(`estranho${i}`) });
  const ok = await call(req(`/v1/academies/${A}`), { fetchImpl: db.fetchImpl, verify: verifyAs('dono') });
  assert.equal(ok.res.status, 200);
});
