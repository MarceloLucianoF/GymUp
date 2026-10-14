import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, resetRateLimit } from '../src/index.js';
import { readFileSync, readdirSync } from 'node:fs';
import { makeD1, seedAcademy, seedMember } from './helpers.js';

const BASE_ENV = { FIREBASE_PROJECT_ID: 'demo-gestao', ALLOWED_ORIGINS: 'http://localhost:5174', ADMIN_OPS_ENABLED: 'true' };
const A = 'academiaaaaaaaaaaaa';
const B = 'academiabbbbbbbbbbbb';

const verifyAs = (uid, extra = {}) => async () => ({ sub: uid, email: `${uid}@example.invalid`, ...extra });
const req = (path, { token = 'tok', method = 'GET', origin, headers = {}, body } = {}) =>
  new Request(`https://api.test${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const call = async (d1, r, deps = {}, env = {}) => {
  const res = await handleRequest(r, { ...BASE_ENV, DB: d1, ...env }, { now: Date.parse('2026-10-14T12:00:00Z'), ...deps });
  return { res, json: await res.json().catch(() => null) };
};
const count = (d1, table) => d1.raw.prepare(`SELECT count(*) n FROM ${table}`).get().n;
const world = () => {
  const d1 = makeD1();
  seedAcademy(d1, A, 'Academia A'); seedAcademy(d1, B, 'Academia B', 'suspended');
  for (const [uid, role] of [['dono', 'owner'], ['adm', 'admin'], ['prof', 'teacher'], ['rec', 'reception'], ['alu', 'student']]) seedMember(d1, A, uid, role);
  seedMember(d1, A, 'susp', 'teacher', 'suspended');
  seedMember(d1, B, 'donoB', 'owner');
  return d1;
};

test.beforeEach(() => resetRateLimit());

test('health é público, não toca no banco e não expõe o projeto', async () => {
  const { res, json } = await call(null, req('/v1/health', { token: null }));
  assert.equal(res.status, 200);
  assert.deepEqual(json.data, { status: 'ok', service: 'bohtreinar-academy-worker' });
  assert.ok(json.requestId);
});

test('sem token: 401 no_token; token inválido, malformado ou expirado: 401 invalid_token sem vazar o motivo', async () => {
  const d1 = world();
  let r = await call(d1, req('/v1/me', { token: null }));
  assert.equal(r.res.status, 401);
  assert.equal(r.json.error.code, 'no_token');
  r = await call(d1, req('/v1/me', { token: 'lixo' }));                                       // verificação real
  assert.equal(r.json.error.code, 'invalid_token');
  r = await call(d1, req('/v1/me'), { verify: async () => { throw new Error('Token expirado'); } });
  assert.equal(r.json.error.code, 'invalid_token');
  assert.ok(!JSON.stringify(r.json).includes('expirado'));
});

test('usuário sem academia: /me e /academies devolvem listas vazias', async () => {
  const d1 = world();
  let r = await call(d1, req('/v1/me'), { verify: verifyAs('solto') });
  assert.deepEqual(r.json.data.memberships, []);
  r = await call(d1, req('/v1/academies'), { verify: verifyAs('solto') });
  assert.deepEqual(r.json.data.academies, []);
});

test('/me: papéis diferentes em academias diferentes; academia suspensa aparece com o status', async () => {
  const d1 = world();
  seedMember(d1, B, 'alu', 'owner');   // alu é aluno na A e dono na B (suspensa)
  const { json } = await call(d1, req('/v1/me'), { verify: verifyAs('alu') });
  const byId = Object.fromEntries(json.data.memberships.map((m) => [m.academyId, m]));
  assert.equal(byId[A].role, 'student');
  assert.equal(byId[A].academy.status, 'active');
  assert.equal(byId[B].role, 'owner');
  assert.equal(byId[B].academy.status, 'suspended');
});

test('academia: membro ativo lê; sem vínculo, vínculo inativo e academia suspensa são 403 distintos', async () => {
  const d1 = world();
  const get = (uid, id) => call(d1, req(`/v1/academies/${id}`), { verify: verifyAs(uid) });
  let r = await get('alu', A);
  assert.equal(r.res.status, 200);
  assert.deepEqual(r.json.data, { academyId: A, name: 'Academia A', status: 'active', myRole: 'student' });
  assert.equal((await get('estranho', A)).json.error.code, 'no_membership');
  assert.equal((await get('susp', A)).json.error.code, 'membership_inactive');
  r = await get('donoB', B);
  assert.equal(r.json.error.code, 'academy_unavailable');
  assert.equal(r.res.status, 403);
  assert.equal((await get('dono', 'inexistente00000000')).json.error.code, 'no_membership');
});

test('isolamento: dono da A não alcança a B (nem leitura, nem membros)', async () => {
  const d1 = world();
  seedAcademy(d1, 'academiaccccccccccc', 'Academia C');
  seedMember(d1, 'academiaccccccccccc', 'donoC', 'owner');
  for (const path of ['/v1/academies/academiaccccccccccc', '/v1/academies/academiaccccccccccc/members']) {
    const { json } = await call(d1, req(path), { verify: verifyAs('dono') });
    assert.equal(json.error.code, 'no_membership');
  }
});

test('membros: só dono e admin; os demais papéis recebem forbidden_role; resposta sem consentimento nem e-mail', async () => {
  const d1 = world();
  for (const uid of ['prof', 'rec', 'alu']) {
    const { res, json } = await call(d1, req(`/v1/academies/${A}/members`), { verify: verifyAs(uid) });
    assert.equal(res.status, 403, uid);
    assert.equal(json.error.code, 'forbidden_role', uid);
  }
  for (const uid of ['dono', 'adm']) {
    const { res, json } = await call(d1, req(`/v1/academies/${A}/members`), { verify: verifyAs(uid) });
    assert.equal(res.status, 200, uid);
    assert.equal(json.data.members.length, 6);
    assert.deepEqual(Object.keys(json.data.members[0]).sort(), ['displayName', 'role', 'status', 'userId']);
    assert.ok(!JSON.stringify(json).includes('@example'));
  }
});

test('papel e academia enviados pelo cliente não valem: query string e cabeçalhos são ignorados', async () => {
  const d1 = world();
  const { res, json } = await call(d1, req(`/v1/academies/${A}/members?role=owner&userId=alu`, { headers: { 'X-Role': 'owner', 'X-Academy-Id': A } }), { verify: verifyAs('alu') });
  assert.equal(res.status, 403);
  assert.equal(json.error.code, 'forbidden_role');
});

test('caminho arbitrário, id inválido, injeção e método errado nunca chegam ao banco', async () => {
  const sql = [];
  const spy = { prepare: (s) => { sql.push(s); throw new Error('não deveria consultar'); } };
  const run = (path, opts) => call(spy, req(path, opts), { verify: verifyAs('u') });
  assert.equal((await run('/v1/academies/..%2Fusers')).res.status, 404);
  assert.equal((await run('/v1/academies/a/b/c')).res.status, 404);
  assert.equal((await run("/v1/academies/x'%20OR%201=1--")).res.status, 404);
  assert.equal((await run('/v1/colecao/users')).res.status, 404);
  assert.equal((await run('/outro')).res.status, 404);
  assert.equal((await run('/v1/me', { method: 'POST', body: {} })).json.error.code, 'method_not_allowed');
  assert.equal(sql.length, 0);
});

test('kill switch: com ADMIN_OPS_ENABLED desligado qualquer escrita é 503 e o banco não é tocado; leituras seguem', async () => {
  const d1 = world();
  const before = count(d1, 'academies');
  let r = await call(d1, req('/v1/academies', { method: 'POST', headers: { 'Idempotency-Key': 'chave-0001' }, body: { name: 'Nova' } }), { verify: verifyAs('u') }, { ADMIN_OPS_ENABLED: 'false' });
  assert.equal(r.res.status, 503);
  assert.equal(r.json.error.code, 'ops_disabled');
  assert.equal(count(d1, 'academies'), before);
  r = await call(d1, req('/v1/me'), { verify: verifyAs('u') }, { ADMIN_OPS_ENABLED: 'false' });
  assert.equal(r.res.status, 200);
});

test('CORS: origem desconhecida é 403; permitida recebe cabeçalhos; OPTIONS responde 204', async () => {
  let r = await call(null, req('/v1/health', { token: null, origin: 'https://malvado.example' }));
  assert.equal(r.res.status, 403);
  assert.equal(r.json.error.code, 'origin_not_allowed');
  r = await call(null, req('/v1/health', { token: null, origin: 'http://localhost:5174' }));
  assert.equal(r.res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5174');
  const pre = await handleRequest(req('/v1/me', { token: null, method: 'OPTIONS', origin: 'http://localhost:5174' }), BASE_ENV);
  assert.equal(pre.status, 204);
});

test('rate limit por usuário: a 61ª chamada no minuto é 429 com Retry-After; outro usuário e outro IP seguem', async () => {
  const d1 = world();
  const ip = { 'CF-Connecting-IP': '198.51.100.1' };
  let last;
  for (let i = 0; i < 61; i += 1) last = await call(d1, req('/v1/me', { headers: ip }), { verify: verifyAs('spam') });
  assert.equal(last.res.status, 429);
  assert.equal(last.res.headers.get('Retry-After'), '60');
  const other = await call(d1, req('/v1/me', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }), { verify: verifyAs('calmo') });
  assert.equal(other.res.status, 200);
});

test('um estranho não consome o limite da academia de outra pessoa', async () => {
  const d1 = world();
  for (let i = 0; i < 40; i += 1) await call(d1, req(`/v1/academies/${A}`, { headers: { 'CF-Connecting-IP': `10.0.0.${i}` } }), { verify: verifyAs(`estranho${i}`) });
  const ok = await call(d1, req(`/v1/academies/${A}`), { verify: verifyAs('dono') });
  assert.equal(ok.res.status, 200);
});

test('falha do banco: 502 genérico, sem detalhes internos', async () => {
  const broken = { prepare: () => ({ bind: () => ({ first: async () => { throw new Error('segredo interno do banco'); }, all: async () => { throw new Error('segredo interno do banco'); } }) }) };
  const { res, json } = await call(broken, req('/v1/me'), { verify: verifyAs('u') });
  assert.equal(res.status, 502);
  assert.equal(json.error.code, 'upstream_error');
  assert.ok(!JSON.stringify(json).includes('segredo'));
});

// ---------- criar academia ----------
const create = (d1, body, { key = 'chave-0001', uid = 'novo', extra = {}, env = {}, deps = {} } = {}) =>
  call(d1, req('/v1/academies', { method: 'POST', headers: { ...(key ? { 'Idempotency-Key': key } : {}) }, body }), { verify: verifyAs(uid, extra), ...deps }, env);

test('criar academia: cria academia, dono ativo e auditoria juntos; nome do token, não do corpo', async () => {
  const d1 = world();
  const { res, json } = await create(d1, { name: '  Minha Academia  ' }, { extra: { name: 'Fulano de Tal' } });
  assert.equal(res.status, 200);
  assert.equal(json.data.name, 'Minha Academia');
  assert.equal(json.data.myRole, 'owner');
  const id = json.data.academyId;
  const m = d1.raw.prepare('SELECT * FROM academy_members WHERE academy_id = ?').get(id);
  assert.equal(m.user_id, 'novo');
  assert.equal(m.role, 'owner');
  assert.equal(m.status, 'active');
  assert.equal(m.display_name, 'Fulano de Tal');
  const log = d1.raw.prepare('SELECT * FROM academy_audit_log WHERE academy_id = ?').all(id);
  assert.equal(log.length, 1);
  assert.deepEqual([log[0].actor_id, log[0].action, log[0].target_id], ['novo', 'academy.created', id]);
  assert.match(log[0].at, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  // o criador já acessa a academia e a lista
  const me = await call(d1, req('/v1/academies'), { verify: verifyAs('novo') });
  assert.equal(me.json.data.academies[0].myRole, 'owner');
});

test('criar academia é idempotente: mesma chave e corpo repete o resultado; corpo diferente é 409', async () => {
  const d1 = world();
  const before = count(d1, 'academies');
  const one = await create(d1, { name: 'Repetida' });
  const two = await create(d1, { name: 'Repetida' });
  assert.deepEqual(two.json.data, one.json.data);
  assert.equal(count(d1, 'academies'), before + 1);
  assert.equal(count(d1, 'academy_audit_log'), 1);
  const diff = await create(d1, { name: 'Outro nome' });
  assert.equal(diff.res.status, 409);
  assert.equal(diff.json.error.code, 'conflict');
  assert.equal(count(d1, 'academies'), before + 1);
  // a mesma chave de OUTRO usuário é independente
  const other = await create(d1, { name: 'Repetida' }, { uid: 'outro' });
  assert.notEqual(other.json.data.academyId, one.json.data.academyId);
});

test('criar academia exige Idempotency-Key válida e esquema fechado (role, academyId, userId, createdBy são recusados)', async () => {
  const d1 = world();
  const before = count(d1, 'academies');
  assert.equal((await create(d1, { name: 'Sem chave' }, { key: null })).json.error.code, 'idempotency_required');
  assert.equal((await create(d1, { name: 'Chave curta' }, { key: 'abc' })).json.error.code, 'idempotency_required');
  assert.equal((await create(d1, { name: 'Chave ruim' }, { key: 'chave com espaço!' })).json.error.code, 'idempotency_required');
  for (const extra of [{ role: 'owner' }, { academyId: A }, { userId: 'dono' }, { createdBy: 'dono' }, { status: 'active' }]) {
    const r = await create(d1, { name: 'Forjada', ...extra }, { key: `chave-${Object.keys(extra)[0]}` });
    assert.equal(r.res.status, 400, JSON.stringify(extra));
    assert.equal(r.json.error.code, 'invalid_request');
  }
  for (const body of [{}, { name: 'a' }, { name: 'x'.repeat(81) }, { name: 5 }, '[]', 'nao-json', { name: null }]) {
    assert.equal((await create(d1, body, { key: `chave-${Math.random()}`.slice(0, 20) })).res.status, 400, JSON.stringify(body));
  }
  assert.equal((await create(d1, { name: 'x', pad: 'y'.repeat(9000) }, { key: 'chave-grande' })).res.status, 413);
  assert.equal(count(d1, 'academies'), before);
});

test('criar academia: limite de 5 academias como dono', async () => {
  const d1 = world();
  for (let i = 0; i < 5; i += 1) assert.equal((await create(d1, { name: `Academia ${i}` }, { key: `chave-lim-${i}` })).res.status, 200);
  const r = await create(d1, { name: 'Sexta' }, { key: 'chave-lim-6' });
  assert.equal(r.json.error.code, 'limit_reached');
});

test('criar academia: se a auditoria falha, NADA é gravado (mesmo batch) e a resposta não vaza o motivo', async () => {
  const d1 = world();
  d1.raw.prepare("INSERT INTO academy_audit_log (id, academy_id, actor_id, action, target_type, target_id, at) VALUES ('auditcolidindo0000001', ?, 'x', 'academy.updated', 'academy', 'x', '2026-10-14T00:00:00.000Z')").run(A);
  const ids = ['novaacademiaid000000001', 'auditcolidindo0000001'];
  const before = [count(d1, 'academies'), count(d1, 'academy_members'), count(d1, 'idempotency_keys')];
  const r = await create(d1, { name: 'Vai falhar' }, { deps: { newId: () => ids.shift() } });
  assert.equal(r.res.status, 409);
  assert.deepEqual([count(d1, 'academies'), count(d1, 'academy_members'), count(d1, 'idempotency_keys')], before);
  assert.ok(!JSON.stringify(r.json).includes('UNIQUE'));
});

test('e-mail só é gravado quando verificado; nunca vem do corpo', async () => {
  const d1 = world();
  const a = await create(d1, { name: 'Sem verificação' }, { uid: 'u1', extra: { email_verified: false }, key: 'chave-email-1' });
  const b = await create(d1, { name: 'Com verificação' }, { uid: 'u2', extra: { email_verified: true }, key: 'chave-email-2' });
  const email = (id, uid) => d1.raw.prepare('SELECT email FROM academy_members WHERE academy_id = ? AND user_id = ?').get(id, uid).email;
  assert.equal(email(a.json.data.academyId, 'u1'), '');
  assert.equal(email(b.json.data.academyId, 'u2'), 'u2@example.invalid');
});

test('corrida na mesma chave: a segunda requisição recebe o resultado salvo, não um 409', async () => {
  const d1 = world();
  const first = await create(d1, { name: 'Corrida' }, { key: 'chave-corrida' });
  const total = count(d1, 'academies');
  // simula a perda da corrida: a checagem inicial não vê a chave, mas o INSERT bate no UNIQUE
  const real = d1.prepare;
  let hidden = true;
  d1.prepare = (sql) => (hidden && sql.includes('FROM idempotency_keys') ? { bind: () => ({ first: async () => { hidden = false; return null; } }) } : real(sql));
  const second = await create(d1, { name: 'Corrida' }, { key: 'chave-corrida' });
  assert.equal(second.res.status, 200);
  assert.deepEqual(second.json.data, first.json.data);
  assert.equal(count(d1, 'academies'), total);   // nada novo foi gravado
});

test('limite de academias é garantido pelo banco mesmo sem a checagem do Worker', async () => {
  const d1 = world();
  for (let i = 0; i < 5; i += 1) await create(d1, { name: `Academia ${i}` }, { key: `chave-banco-${i}` });
  const real = d1.prepare;
  d1.prepare = (sql) => (sql.includes("role = 'owner' AND status = 'active'") && sql.includes('count(*)') ? { bind: () => ({ first: async () => ({ n: 0 }) }) } : real(sql));
  const r = await create(d1, { name: 'Furou a fila' }, { key: 'chave-banco-9' });
  assert.equal(r.json.error.code, 'limit_reached');
});

test('convenção: o Worker nunca usa INSERT OR REPLACE (não aciona gatilhos de DELETE)', () => {
  for (const f of readdirSync(new URL('../src/', import.meta.url))) {
    assert.ok(!/OR REPLACE|REPLACE INTO/i.test(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')), f);
  }
});
