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

// ---------- convites, entrada, papéis, saída e auditoria ----------
const post = (d1, uid, path, body, deps = {}, key) => call(d1, req(path, { method: 'POST', body: body ?? {}, headers: key ? { 'Idempotency-Key': key } : {} }), { verify: verifyAs(uid, { name: `Nome ${uid}` }), ...deps });
const get = (d1, uid, path, deps = {}) => call(d1, req(path), { verify: verifyAs(uid), ...deps });
const preview = (d1, uid, code, deps = {}) => post(d1, uid, '/v1/invites/preview', { code }, deps);
const accept = (d1, uid, code, deps = {}, extra = {}) => post(d1, uid, '/v1/invites/accept', { code, ...extra }, deps);
const invite = async (d1, uid, role = 'student', extra = {}) => (await post(d1, uid, `/v1/academies/${A}/invites`, { role, ...extra })).json.data;
const row = (d1, sql, ...p) => d1.raw.prepare(sql).get(...p);
const DAY = 86_400_000;
const T0 = Date.parse('2026-10-14T12:00:00Z');

test('convite: dono cria; o código aparece uma vez, só o hash fica no banco; a lista nunca mostra código', async () => {
  const d1 = world();
  const r = await post(d1, 'dono', `/v1/academies/${A}/invites`, { role: 'student', maxUses: 3, expiresInDays: 5 });
  assert.equal(r.res.status, 200);
  assert.match(r.json.data.code, /^[a-z0-9]{32}$/);
  assert.equal(r.json.data.expiresAt, new Date(T0 + 5 * DAY).toISOString());
  const stored = row(d1, 'SELECT * FROM academy_invites WHERE id = ?', r.json.data.inviteId);
  assert.notEqual(stored.code_hash, r.json.data.code);
  assert.equal(stored.code_hash.length, 64);
  assert.equal(JSON.stringify(stored).includes(r.json.data.code), false);
  assert.equal(row(d1, "SELECT count(*) n FROM academy_audit_log WHERE action = 'invite.created' AND academy_id = ?", A).n, 1);
  const list = await get(d1, 'adm', `/v1/academies/${A}/invites`);
  assert.equal(list.json.data.invites.length, 1);
  assert.ok(!JSON.stringify(list.json).includes(r.json.data.code));
  assert.ok(!('codeHash' in list.json.data.invites[0]) && !('code_hash' in list.json.data.invites[0]));
});

test('convite: matriz de papéis (admin não cria admin; recepção só aluno; professor e aluno não criam)', async () => {
  const d1 = world();
  const mk = (uid, role) => post(d1, uid, `/v1/academies/${A}/invites`, { role });
  assert.equal((await mk('dono', 'admin')).res.status, 200);
  assert.equal((await mk('adm', 'admin')).json.error.code, 'forbidden_role');
  assert.equal((await mk('adm', 'teacher')).res.status, 200);
  assert.equal((await mk('rec', 'student')).res.status, 200);
  assert.equal((await mk('rec', 'teacher')).json.error.code, 'forbidden_role');
  assert.equal((await mk('prof', 'student')).json.error.code, 'forbidden_role');
  assert.equal((await mk('alu', 'student')).json.error.code, 'forbidden_role');
  assert.equal((await mk('dono', 'owner')).json.error.code, 'forbidden_role');     // dono nunca por convite
  assert.equal((await mk('estranho', 'student')).json.error.code, 'no_membership');
  assert.equal((await get(d1, 'prof', `/v1/academies/${A}/invites`)).json.error.code, 'forbidden_role');
});

test('convite: payload inválido ou com campo extra é recusado e nada é gravado', async () => {
  const d1 = world();
  for (const body of [{}, { role: 'superuser' }, { role: 'student', maxUses: 0 }, { role: 'student', maxUses: 501 }, { role: 'student', expiresInDays: 0 }, { role: 'student', expiresInDays: 31 }, { role: 'student', maxUses: 1.5 }, { role: 'student', academyId: B }, { role: 'student', createdBy: 'x' }]) {
    const r = await post(d1, 'dono', `/v1/academies/${A}/invites`, body);
    assert.equal(r.res.status, 400, JSON.stringify(body));
  }
  assert.equal(count(d1, 'academy_invites'), 0);
});

test('convite: prévia mostra só academia e papel; código inexistente, malformado, expirado, revogado e esgotado dão o mesmo erro', async () => {
  const d1 = world();
  const i = await invite(d1, 'dono', 'student', { maxUses: 1 });
  const prev = await preview(d1, 'novo', i.code);
  assert.equal(prev.res.status, 200);
  assert.deepEqual(Object.keys(prev.json.data).sort(), ['academyName', 'expiresAt', 'role']);
  assert.equal(prev.json.data.academyName, 'Academia A');
  const codes = [];
  for (const c of ['a'.repeat(32), 'curto', `${i.code}x`]) codes.push((await preview(d1, 'novo', c)).json.error.code);
  assert.deepEqual(new Set(codes), new Set(['invite_invalid']));
  codes.push((await preview(d1, 'novo', 'A'.repeat(32))).json.error.code, (await preview(d1, 'novo', 123)).json.error.code);   // formato errado: o mesmo erro, nem chega ao banco
  assert.deepEqual(new Set(codes), new Set(['invite_invalid']));
  assert.equal((await post(d1, 'novo', '/v1/invites/preview', {})).json.error.code, 'invite_invalid');
  assert.equal((await get(d1, 'novo', `/v1/invites/${i.code}`)).res.status, 404);   // o código não é mais aceito na URL
  assert.equal((await preview(d1, 'novo', i.code, { now: T0 + 8 * DAY })).json.error.code, 'invite_invalid');      // expirado
  await post(d1, 'dono', `/v1/academies/${A}/invites/${i.inviteId}/revoke`);
  assert.equal((await preview(d1, 'novo', i.code)).json.error.code, 'invite_invalid');                         // revogado
});

test('aceitar convite: vira membro com o papel do convite (não do corpo), uso somado e auditoria no mesmo batch', async () => {
  const d1 = world();
  const i = await invite(d1, 'dono', 'teacher', { maxUses: 2 });
  assert.equal((await accept(d1, 'novo', i.code, {}, { role: 'owner' })).res.status, 400);     // corpo com role é recusado
  assert.equal(row(d1, 'SELECT count(*) n FROM academy_members WHERE user_id = ?', 'novo').n, 0);
  const r = await accept(d1, 'novo', i.code);
  assert.equal(r.res.status, 200);
  assert.deepEqual(r.json.data, { academyId: A, academyName: 'Academia A', role: 'teacher' });
  const m = row(d1, 'SELECT * FROM academy_members WHERE academy_id = ? AND user_id = ?', A, 'novo');
  assert.deepEqual([m.role, m.status, m.display_name], ['teacher', 'active', 'Nome novo']);
  assert.equal(row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses, 1);
  const log = row(d1, "SELECT * FROM academy_audit_log WHERE action = 'member.joined' AND target_id = 'novo'");
  assert.deepEqual([log.actor_id, log.detail], ['novo', 'teacher,active']);
  assert.equal((await accept(d1, 'novo', i.code)).json.error.code, 'already_member');
  assert.equal(row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses, 1);   // recusado não soma uso
});

test('aceitar convite: esgotado, expirado, revogado e academia suspensa não gravam nada', async () => {
  const d1 = world();
  const i = await invite(d1, 'dono', 'student', { maxUses: 2 });
  for (const uid of ['u1', 'u2']) assert.equal((await accept(d1, uid, i.code)).res.status, 200);
  const before = count(d1, 'academy_members');
  assert.equal((await accept(d1, 'u3', i.code)).json.error.code, 'invite_invalid');     // esgotado
  assert.equal(count(d1, 'academy_members'), before);
  assert.equal(row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses, 2);
  const e = await invite(d1, 'dono', 'student');
  assert.equal((await accept(d1, 'u4', e.code, { now: T0 + 9 * DAY })).json.error.code, 'invite_invalid');   // expirado
  const rv = await invite(d1, 'dono', 'student');
  await post(d1, 'dono', `/v1/academies/${A}/invites/${rv.inviteId}/revoke`);
  assert.equal((await accept(d1, 'u5', rv.code)).json.error.code, 'invite_invalid');
  const s = await invite(d1, 'dono', 'student');
  d1.raw.prepare("UPDATE academies SET status = 'suspended' WHERE id = ?").run(A);
  assert.equal((await accept(d1, 'u6', s.code)).json.error.code, 'invite_invalid');
  assert.equal(row(d1, "SELECT count(*) n FROM academy_members WHERE user_id IN ('u3','u4','u5','u6')").n, 0);
});

test('aceitar convite: suspenso e removido não voltam por convite; quem saiu volta com o papel novo', async () => {
  const d1 = world();
  seedMember(d1, A, 'rem', 'student', 'removed');
  seedMember(d1, A, 'saiu', 'student', 'left');
  const i = await invite(d1, 'dono', 'teacher', { maxUses: 10 });
  assert.equal((await accept(d1, 'susp', i.code)).json.error.code, 'conflict');
  assert.equal((await accept(d1, 'rem', i.code)).json.error.code, 'conflict');
  const back = await accept(d1, 'saiu', i.code);
  assert.equal(back.res.status, 200);
  assert.deepEqual([row(d1, "SELECT role FROM academy_members WHERE user_id = 'saiu'").role, row(d1, "SELECT status FROM academy_members WHERE user_id = 'saiu'").status], ['teacher', 'active']);
  assert.equal(row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses, 1);
});

test('revogar convite: auditado, só da própria academia e só dentro do papel; repetir é inofensivo', async () => {
  const d1 = world();
  seedAcademy(d1, 'academiaccccccccccc', 'Academia C'); seedMember(d1, 'academiaccccccccccc', 'donoC', 'owner');
  const adminInv = await invite(d1, 'dono', 'admin');
  const stu = await invite(d1, 'dono', 'student');
  assert.equal((await post(d1, 'adm', `/v1/academies/${A}/invites/${adminInv.inviteId}/revoke`)).json.error.code, 'forbidden_role');   // admin não mexe em convite de admin
  assert.equal((await post(d1, 'rec', `/v1/academies/${A}/invites/${adminInv.inviteId}/revoke`)).json.error.code, 'forbidden_role');
  assert.equal((await post(d1, 'prof', `/v1/academies/${A}/invites/${stu.inviteId}/revoke`)).json.error.code, 'forbidden_role');
  assert.equal((await post(d1, 'donoC', `/v1/academies/academiaccccccccccc/invites/${stu.inviteId}/revoke`)).json.error.code, 'not_found');   // convite de outra academia
  assert.equal((await post(d1, 'dono', `/v1/academies/${A}/invites/${stu.inviteId}/revoke`)).res.status, 200);
  assert.equal((await post(d1, 'dono', `/v1/academies/${A}/invites/${stu.inviteId}/revoke`)).res.status, 200);
  assert.equal(row(d1, "SELECT count(*) n FROM academy_audit_log WHERE action = 'invite.revoked'").n, 1);   // a repetição não duplica a auditoria
});

test('papéis: dono gerencia; admin só professor, recepção e aluno; ninguém altera o próprio vínculo', async () => {
  const d1 = world();
  const act = (uid, target, body) => post(d1, uid, `/v1/academies/${A}/members/${target}`, body);
  let r = await act('dono', 'prof', { status: 'suspended' });
  assert.deepEqual(r.json.data, { userId: 'prof', role: 'teacher', status: 'suspended' });
  const log = row(d1, "SELECT * FROM academy_audit_log WHERE action = 'member.updated'");
  assert.deepEqual([log.actor_id, log.target_id, log.detail], ['dono', 'prof', 'teacher,suspended']);
  assert.equal((await act('dono', 'prof', { status: 'active' })).res.status, 200);                       // reativar
  assert.equal((await act('adm', 'rec', { status: 'suspended' })).res.status, 200);                      // admin em recepção
  assert.equal((await act('adm', 'dono', { status: 'suspended' })).json.error.code, 'forbidden_role');   // admin não toca em dono
  assert.equal((await act('adm', 'adm', { status: 'suspended' })).json.error.code, 'forbidden_role');    // nem em si mesmo
  assert.equal((await act('adm', 'prof', { role: 'admin' })).json.error.code, 'forbidden_role');         // nem promove a admin
  assert.equal((await act('adm', 'prof', { role: 'owner' })).json.error.code, 'forbidden_role');
  assert.equal((await act('dono', 'dono', { role: 'admin' })).json.error.code, 'forbidden_role');        // dono não se rebaixa por aqui
  for (const uid of ['prof', 'alu']) assert.equal((await act(uid, 'alu', { status: 'removed' })).json.error.code, 'forbidden_role', uid);
  assert.equal((await act('dono', 'prof', {})).res.status, 400);
  assert.equal((await act('dono', 'prof', { status: 'left' })).res.status, 400);                         // 'left' só o próprio membro
  assert.equal((await act('dono', 'prof', { status: 'banido' })).res.status, 400);
  assert.equal((await act('dono', 'prof', { role: 'chefe' })).res.status, 400);
  assert.equal((await act('dono', 'prof', { userId: 'x', status: 'active' })).res.status, 400);          // campo extra
  assert.equal((await act('dono', 'inexistente', { status: 'active' })).json.error.code, 'not_found');
  assert.equal((await act('estranho', 'prof', { status: 'active' })).json.error.code, 'no_membership');
});

test('papéis: removido só volta pelo dono; promover a dono e proteger o último dono', async () => {
  const d1 = world();
  const act = (uid, target, body) => post(d1, uid, `/v1/academies/${A}/members/${target}`, body);
  assert.equal((await act('adm', 'prof', { status: 'removed' })).res.status, 200);
  assert.equal((await act('adm', 'prof', { status: 'active' })).json.error.code, 'forbidden_role');      // admin não reativa removido
  assert.equal((await act('adm', 'prof', { role: 'student' })).json.error.code, 'forbidden_role');       // removido não muda papel
  assert.equal((await act('dono', 'prof', { status: 'active' })).res.status, 200);
  assert.equal((await act('dono', 'adm', { role: 'owner' })).res.status, 200);                           // segundo dono
  assert.equal((await act('adm', 'dono', { status: 'removed' })).res.status, 200);                        // o novo dono remove o antigo
  const leave = await post(d1, 'adm', `/v1/me/academies/${A}/leave`);                                    // agora é o único dono
  assert.equal(leave.res.status, 409);
  assert.equal(row(d1, "SELECT status FROM academy_members WHERE user_id = 'adm'").status, 'active');
});

test('papéis: aluno com registros não muda de papel (banco recusa com conflict)', async () => {
  const d1 = world();
  d1.raw.prepare("INSERT INTO academy_consents (academy_id, user_id, kind, status, text_version, granted_at) VALUES (?, 'alu', 'adherence', 'granted', 'v1', '2026-10-14T00:00:00.000Z')").run(A);
  const r = await post(d1, 'dono', `/v1/academies/${A}/members/alu`, { role: 'teacher' });
  assert.equal(r.res.status, 409);
  assert.equal(row(d1, "SELECT role FROM academy_members WHERE user_id = 'alu'").role, 'student');
  assert.equal(row(d1, "SELECT count(*) n FROM academy_audit_log WHERE action = 'member.updated'").n, 0);   // sem mudança, sem auditoria
});

test('sair: aluno sai, consentimento e aderência são apagados, perde o acesso e a saída é auditada; repetir não vale', async () => {
  const d1 = world();
  d1.raw.prepare("INSERT INTO academy_consents (academy_id, user_id, kind, status, text_version, granted_at) VALUES (?, 'alu', 'adherence', 'granted', 'v1', '2026-10-14T00:00:00.000Z')").run(A);
  d1.raw.prepare("INSERT INTO academy_adherence (academy_id, user_id, status, week_workouts, active_days, streak, updated_at) VALUES (?, 'alu', 'em_dia', 3, 3, 3, '2026-10-14T00:00:00.000Z')").run(A);
  const r = await post(d1, 'alu', `/v1/me/academies/${A}/leave`);
  assert.deepEqual(r.json.data, { academyId: A, status: 'left' });
  assert.equal(row(d1, "SELECT status FROM academy_members WHERE user_id = 'alu'").status, 'left');
  assert.equal(count(d1, 'academy_consents'), 0);
  assert.equal(count(d1, 'academy_adherence'), 0);
  assert.equal(row(d1, "SELECT actor_id FROM academy_audit_log WHERE action = 'member.left'").actor_id, 'alu');
  assert.equal((await get(d1, 'alu', `/v1/academies/${A}`)).json.error.code, 'membership_inactive');
  assert.equal((await post(d1, 'alu', `/v1/me/academies/${A}/leave`)).json.error.code, 'no_membership');
  assert.equal((await post(d1, 'estranho', `/v1/me/academies/${A}/leave`)).json.error.code, 'no_membership');
  assert.equal((await post(d1, 'dono', `/v1/me/academies/${A}/leave`)).res.status, 409);                  // único dono
});

test('auditoria: dono e admin leem em ordem decrescente; professor, recepção, aluno e outra academia não', async () => {
  const d1 = world();
  const i = await invite(d1, 'dono', 'student');
  await accept(d1, 'novo', i.code);
  await post(d1, 'dono', `/v1/academies/${A}/members/susp`, { status: 'active' }, { now: T0 + 1000 });
  const r = await get(d1, 'adm', `/v1/academies/${A}/audit`);
  assert.equal(r.res.status, 200);
  assert.deepEqual(r.json.data.entries.map((e) => e.action), ['member.updated', 'member.joined', 'invite.created']);
  assert.deepEqual(Object.keys(r.json.data.entries[0]).sort(), ['action', 'actorId', 'at', 'detail', 'id', 'targetId', 'targetType']);
  for (const uid of ['prof', 'rec', 'alu']) assert.equal((await get(d1, uid, `/v1/academies/${A}/audit`)).json.error.code, 'forbidden_role', uid);
  assert.equal((await get(d1, 'donoB', `/v1/academies/${A}/audit`)).json.error.code, 'no_membership');
  assert.equal((await post(d1, 'dono', `/v1/academies/${A}/audit`)).json.error.code, 'method_not_allowed');
});

test('isolamento: dono da A não mexe em convite, membro nem auditoria da B', async () => {
  const d1 = world();
  seedAcademy(d1, 'academiaccccccccccc', 'Academia C'); seedMember(d1, 'academiaccccccccccc', 'donoC', 'owner'); seedMember(d1, 'academiaccccccccccc', 'aluC', 'student');
  const C = 'academiaccccccccccc';
  for (const [method, path, body] of [
    ['POST', `/v1/academies/${C}/invites`, { role: 'student' }], ['GET', `/v1/academies/${C}/invites`], ['GET', `/v1/academies/${C}/audit`],
    ['POST', `/v1/academies/${C}/members/aluC`, { status: 'removed' }]
  ]) {
    const r = await call(d1, req(path, { method, body }), { verify: verifyAs('dono') });
    assert.equal(r.json.error.code, 'no_membership', path);
  }
  assert.equal(row(d1, "SELECT status FROM academy_members WHERE user_id = 'aluC'").status, 'active');
  assert.equal(count(d1, 'academy_invites'), 0);
});

test('suspenso não escapa da suspensão: não sai, não volta por convite; quem saiu volta sem permissões antigas', async () => {
  const d1 = world();
  const before = row(d1, "SELECT status FROM academy_members WHERE user_id = 'susp'").status;
  assert.equal(before, 'suspended');
  const r = await post(d1, 'susp', `/v1/me/academies/${A}/leave`);
  assert.equal(r.json.error.code, 'membership_inactive');
  assert.equal(row(d1, "SELECT status FROM academy_members WHERE user_id = 'susp'").status, 'suspended');
  const i = await invite(d1, 'dono', 'student', { maxUses: 5 });
  assert.equal((await accept(d1, 'susp', i.code)).json.error.code, 'conflict');
  // ex-professor com permissão volta como aluno sem a permissão
  d1.raw.prepare("UPDATE academy_members SET can_create_trainings = 1, branch_id = 'filial1' WHERE user_id = 'prof'").run();
  assert.equal((await post(d1, 'prof', `/v1/me/academies/${A}/leave`)).res.status, 200);
  assert.equal((await accept(d1, 'prof', i.code)).res.status, 200);
  const m = row(d1, "SELECT role, can_create_trainings, branch_id FROM academy_members WHERE user_id = 'prof'");
  assert.deepEqual([m.role, m.can_create_trainings, m.branch_id], ['student', 0, null]);
});

test('papéis: alteração concorrente não é sobrescrita (o banco só grava se o alvo e o ator seguem como lidos)', async () => {
  const d1 = world();
  // entre a leitura do alvo e a escrita, outro dono rebaixa o professor para recepção
  const real = d1.batch.bind(d1);
  let once = true;
  d1.batch = async (stmts) => {
    if (once && stmts[0].sql.includes('UPDATE academy_members SET role = ?, status = ?')) {
      once = false;
      d1.raw.prepare("UPDATE academy_members SET role = 'reception' WHERE user_id = 'prof'").run();
    }
    return real(stmts);
  };
  const r = await post(d1, 'dono', `/v1/academies/${A}/members/prof`, { status: 'suspended' });
  assert.equal(r.res.status, 409);
  const m = row(d1, "SELECT role, status FROM academy_members WHERE user_id = 'prof'");
  assert.deepEqual([m.role, m.status], ['reception', 'active']);   // o rebaixamento concorrente foi preservado
  assert.equal(row(d1, "SELECT count(*) n FROM academy_audit_log WHERE action = 'member.updated'").n, 0);
});

test('papéis: ator suspenso entre a leitura e a escrita não conclui a operação', async () => {
  const d1 = world();
  const real = d1.batch.bind(d1);
  d1.batch = async (stmts) => {
    if (stmts[0].sql.includes('UPDATE academy_members SET role = ?, status = ?')) d1.raw.prepare("UPDATE academy_members SET status = 'suspended' WHERE user_id = 'adm'").run();
    return real(stmts);
  };
  const r = await post(d1, 'adm', `/v1/academies/${A}/members/alu`, { status: 'suspended' });
  assert.equal(r.res.status, 409);
  assert.equal(row(d1, "SELECT status FROM academy_members WHERE user_id = 'alu'").status, 'active');
});

test('recepção só vê convites de aluno; sair funciona mesmo com o kill switch ligado', async () => {
  const d1 = world();
  await invite(d1, 'dono', 'admin'); await invite(d1, 'dono', 'teacher'); await invite(d1, 'dono', 'student');
  const rec = await get(d1, 'rec', `/v1/academies/${A}/invites`);
  assert.deepEqual(rec.json.data.invites.map((i) => i.role), ['student']);
  assert.equal((await get(d1, 'adm', `/v1/academies/${A}/invites`)).json.data.invites.length, 2);       // admin não vê convite de admin
  assert.equal((await get(d1, 'dono', `/v1/academies/${A}/invites`)).json.data.invites.length, 3);
  const off = { ...BASE_ENV, ADMIN_OPS_ENABLED: 'false' };
  const res = await handleRequest(req(`/v1/me/academies/${A}/leave`, { method: 'POST', body: {} }), { ...off, DB: d1 }, { now: T0, verify: verifyAs('alu') });
  assert.equal(res.status, 200);
  const blocked = await handleRequest(req(`/v1/academies/${A}/invites`, { method: 'POST', body: { role: 'student' } }), { ...off, DB: d1 }, { now: T0, verify: verifyAs('dono') });
  assert.equal(blocked.status, 503);
});

test('nome de exibição: usa o nome da conta; sem nome, a parte local do e-mail', async () => {
  const d1 = world();
  const a = await create(d1, { name: 'Com nome' }, { uid: 'n1', extra: { name: 'Maria Silva' }, key: 'chave-nome-1' });
  const b = await create(d1, { name: 'Sem nome' }, { uid: 'n2', key: 'chave-nome-2' });
  const dn = (id, uid) => d1.raw.prepare('SELECT display_name FROM academy_members WHERE academy_id = ? AND user_id = ?').get(id, uid).display_name;
  assert.equal(dn(a.json.data.academyId, 'n1'), 'Maria Silva');
  assert.equal(dn(b.json.data.academyId, 'n2'), 'n2');   // e-mail do teste: n2@example.invalid
});
