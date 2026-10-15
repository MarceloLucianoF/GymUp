import test from 'node:test';
import { A, B, C, api, assert, audit, code, count, data, key, resetRateLimit, row, seedAcademy, seedMember, world } from './kit.js';

test.beforeEach(() => resetRateLimit());
const create = (d1, name, opts = {}) => api(d1, opts.uid || 'novo', 'POST', '/v1/academies', { body: { name }, key: opts.key === undefined ? key() : opts.key, ...(opts.rest || {}) });

test('criar academia: academia, dono ativo e auditoria juntos, com request_id; nome vem do token e o e-mail não é gravado', async () => {
  const d1 = world();
  const r = await create(d1, '  ZZ TESTE Gestão Nova  ', { rest: { claims: { name: 'Fulano de Tal', email: 'fulano@example.invalid' } } });
  assert.equal(r.status, 200);
  assert.equal(data(r).name, 'ZZ TESTE Gestão Nova');
  const id = data(r).academyId;
  const m = row(d1, 'SELECT * FROM academy_members WHERE academy_id = ?', id);
  assert.deepEqual([m.user_id, m.role, m.status, m.display_name], ['novo', 'owner', 'active', 'Fulano de Tal']);
  assert.ok(!Object.keys(m).includes('email'));
  const [log] = audit(d1, 'academy.created', id);
  assert.deepEqual([log.actor_uid, log.target_id], ['novo', id]);
  assert.match(log.created_at, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(log.request_id, r.json.requestId);
  assert.equal(data(await api(d1, 'novo', 'GET', '/v1/academies')).academies[0].myRole, 'owner');
});

test('criar academia é idempotente: mesma chave e corpo repete; corpo diferente é 409; chave de outro usuário é independente', async () => {
  const d1 = world();
  const total = count(d1, 'academies');
  const k = key();
  const one = await create(d1, 'ZZ TESTE Repetida', { key: k });
  const two = await create(d1, 'ZZ TESTE Repetida', { key: k });
  assert.deepEqual(data(two), data(one));
  assert.equal(count(d1, 'academies'), total + 1);
  assert.equal(count(d1, 'academy_audit_log', "WHERE action = 'academy.created' AND actor_uid = 'novo'"), 1);
  const diff = await create(d1, 'Outro nome', { key: k });
  assert.deepEqual([diff.status, code(diff)], [409, 'conflict']);
  assert.notEqual(data(await create(d1, 'ZZ TESTE Repetida', { key: k, uid: 'outro' })).academyId, data(one).academyId);
});

test('criar academia: exige chave válida e esquema fechado; role, academyId, userId, actorUid e createdBy nunca valem', async () => {
  const d1 = world();
  const total = count(d1, 'academies');
  for (const bad of [null, 'abc', 'chave com espaço!', 'x'.repeat(65)]) assert.equal(code(await create(d1, 'ZZ TESTE Sem chave', { key: bad })), 'idempotency_required');
  for (const extra of [{ role: 'owner' }, { academyId: A }, { userId: 'dono' }, { actorUid: 'dono' }, { createdBy: 'dono' }, { status: 'active' }]) {
    const r = await api(d1, 'novo', 'POST', '/v1/academies', { body: { name: 'ZZ TESTE Forjada', ...extra }, key: key() });
    assert.deepEqual([r.status, code(r)], [400, 'invalid_request'], JSON.stringify(extra));
  }
  for (const body of [{}, { name: 'a' }, { name: 'x'.repeat(81) }, { name: 5 }, { name: null }]) assert.equal((await api(d1, 'novo', 'POST', '/v1/academies', { body, key: key() })).status, 400, JSON.stringify(body));
  assert.equal(count(d1, 'academies'), total);
});

test('criar academia: limite de 5 como dono (resposta amigável) e o banco garante mesmo sem a checagem do Worker', async () => {
  const d1 = world();
  for (let i = 0; i < 5; i += 1) assert.equal((await create(d1, `ZZ TESTE ${i}`)).status, 200);
  assert.equal(code(await create(d1, 'ZZ TESTE Sexta')), 'limit_reached');
  // sem a checagem do Worker, o gatilho recusa
  const real = d1.prepare;
  d1.prepare = (sql) => (sql.includes("role = 'owner' AND status = 'active'") && sql.includes('count(*)') && sql.includes('AS n') ? { bind: () => ({ first: async () => ({ n: 0 }) }) } : real(sql));
  assert.equal(code(await create(d1, 'ZZ TESTE Furou')), 'limit_reached');
});

test('criar academia: se a auditoria falha, NADA é gravado (mesmo batch) e a resposta não vaza o motivo', async () => {
  const d1 = world();
  d1.raw.prepare("INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, created_at) VALUES ('auditcolidindo0000001', ?, 'x', 'academy.updated', 'academy', 'x', '2026-10-14T00:00:00.000Z')").run(A);
  const ids = ['novaacademiaid000000001', 'auditcolidindo0000001'];
  const before = [count(d1, 'academies'), count(d1, 'academy_members'), count(d1, 'idempotency_keys')];
  const r = await create(d1, 'ZZ TESTE Vai falhar', { rest: { deps: { newId: () => ids.shift() } } });
  assert.deepEqual([r.status, code(r)], [409, 'conflict']);
  assert.deepEqual([count(d1, 'academies'), count(d1, 'academy_members'), count(d1, 'idempotency_keys')], before);
  assert.ok(!JSON.stringify(r.json).includes('UNIQUE'));
});

test('criar academia: corrida na mesma chave devolve o resultado salvo, não 409', async () => {
  const d1 = world();
  const k = key();
  const first = await create(d1, 'ZZ TESTE Corrida', { key: k });
  const total = count(d1, 'academies');
  const real = d1.prepare;
  let hidden = true;
  d1.prepare = (sql) => (hidden && sql.includes('FROM idempotency_keys') ? { bind: () => ({ first: async () => { hidden = false; return null; } }) } : real(sql));
  const second = await create(d1, 'ZZ TESTE Corrida', { key: k });
  assert.equal(second.status, 200);
  assert.deepEqual(data(second), data(first));
  assert.equal(count(d1, 'academies'), total);
});

test('academia: membro ativo lê; sem vínculo, suspenso, removido e academia suspensa dão erros distintos', async () => {
  const d1 = world();
  seedMember(d1, A, 'saiu', 'student', 'removed');
  const get = (uid, id = A) => api(d1, uid, 'GET', `/v1/academies/${id}`);
  assert.deepEqual(data(await get('alu')), { academyId: A, name: 'ZZ TESTE Gestão A', status: 'active', myRole: 'student' });
  assert.equal(code(await get('estranho')), 'no_membership');
  assert.equal(code(await get('susp')), 'membership_inactive');
  assert.equal(code(await get('saiu')), 'no_membership');
  assert.equal(code(await get('donoC', C)), 'academy_unavailable');
});

test('/me e /academies: papéis diferentes em academias diferentes; suspensa aparece com o status; removido some', async () => {
  const d1 = world();
  seedAcademy(d1, 'academiadddddddddd', 'ZZ TESTE D');
  seedMember(d1, B, 'multi', 'owner'); seedMember(d1, A, 'multi', 'student'); seedMember(d1, C, 'multi', 'admin'); seedMember(d1, 'academiadddddddddd', 'multi', 'student', 'removed');
  const me = data(await api(d1, 'multi', 'GET', '/v1/me'));
  const by = Object.fromEntries(me.memberships.map((m) => [m.academyId, m]));
  assert.deepEqual([by[A].role, by[B].role, by[C].role], ['student', 'owner', 'admin']);
  assert.equal(by[C].academy.status, 'suspended');
  assert.equal(me.memberships.length, 3);
  assert.equal(data(await api(d1, 'multi', 'GET', '/v1/academies')).academies.length, 3);
});

test('perfil e edição: dono edita nome, descrição e contato; admin só descrição e contato; os demais não; auditado', async () => {
  const d1 = world();
  const patch = (uid, body) => api(d1, uid, 'PATCH', `/v1/academies/${A}`, { body });
  assert.equal((await patch('dono', { name: 'ZZ TESTE Renomeada', description: 'Musculação e funcional', contactEmail: 'contato@example.invalid' })).status, 200);
  const prof = data(await api(d1, 'alu', 'GET', `/v1/academies/${A}/profile`));
  assert.deepEqual([prof.name, prof.description, prof.contactEmail, prof.myRole], ['ZZ TESTE Renomeada', 'Musculação e funcional', 'contato@example.invalid', 'student']);
  assert.equal((await patch('adm', { description: 'Nova descrição' })).status, 200);
  assert.equal(code(await patch('adm', { name: 'Sequestrada' })), 'forbidden_role');
  for (const uid of ['prof', 'rec', 'alu']) assert.equal(code(await patch(uid, { description: 'x' })), 'forbidden_role', uid);
  assert.equal(code(await patch('estranho', { description: 'x' })), 'no_membership');
  for (const bad of [{}, { description: 'x'.repeat(501) }, { contactEmail: 'sem-arroba' }, { status: 'suspended' }, { name: 'a' }, { ownerId: 'x' }]) assert.equal((await patch('dono', bad)).status, 400, JSON.stringify(bad));
  assert.equal((await patch('dono', { contactEmail: '' })).status, 200);   // limpar o contato é permitido
  const log = audit(d1, 'academy.updated');
  assert.equal(log.length, 3);
  assert.equal(log[0].detail, 'name,description,contactEmail');
  assert.ok(!JSON.stringify(log).includes('contato@'));   // a auditoria guarda os campos, nunca os valores
  assert.equal(row(d1, 'SELECT status FROM academies WHERE id = ?', A).status, 'active');
});

test('dashboard: contagens operacionais; recepção não vê auditoria nem propostas; coach e aluno não acessam', async () => {
  const d1 = world();
  const inv = await api(d1, 'dono', 'POST', `/v1/academies/${A}/invites`, { body: { role: 'student' }, key: key() });
  assert.equal(inv.status, 200);
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: 'alu', coachUid: 'prof' }, key: key() });
  const d = data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/dashboard`));
  assert.deepEqual(d.counts, { members: 7, students: 2, coaches: 2, studentsWithoutCoach: 2, pendingInvites: 1, pendingAssignments: 1, studentsWithoutTraining: 2, studentsOutdated: 0, activeTrainings: 0 });
  assert.ok(d.recentActivity.length >= 2 && d.recentActivity.length <= 5);
  const rec = data(await api(d1, 'rec', 'GET', `/v1/academies/${A}/dashboard`));
  assert.equal(rec.counts.pendingAssignments, null);
  assert.deepEqual(rec.recentActivity, []);
  for (const uid of ['prof', 'alu', 'estranho']) assert.ok(['forbidden_role', 'no_membership'].includes(code(await api(d1, uid, 'GET', `/v1/academies/${A}/dashboard`))), uid);
  const raw = JSON.stringify(d);
  for (const banned of ['weight', 'peso', 'medida', 'carga', 'volume', 'health']) assert.ok(!raw.toLowerCase().includes(banned), banned);
});

test('transferir propriedade: só o dono, com confirmação explícita e chave; o alvo vira dono e quem transfere vira admin; auditado', async () => {
  const d1 = world();
  const tr = (uid, body, k = key()) => api(d1, uid, 'POST', `/v1/academies/${A}/transfer-ownership`, { body, key: k });
  assert.equal(code(await tr('dono', { toUid: 'adm' })), 'invalid_request');                              // sem confirm
  assert.equal(code(await tr('dono', { toUid: 'adm', confirm: false })), 'invalid_request');
  assert.equal(code(await tr('dono', { toUid: 'dono', confirm: true })), 'invalid_request');              // para si mesmo
  assert.equal(code(await tr('dono', { toUid: 'alu', confirm: true })), 'conflict');                      // aluno não vira dono
  assert.equal(code(await tr('dono', { toUid: 'susp', confirm: true })), 'conflict');                     // suspenso não
  assert.equal(code(await tr('dono', { toUid: 'inexistente', confirm: true })), 'not_found');
  for (const uid of ['adm', 'prof', 'rec', 'alu']) assert.equal(code(await tr(uid, { toUid: 'prof', confirm: true })), 'forbidden_role', uid);
  const k = key();
  const ok = await tr('dono', { toUid: 'adm', confirm: true }, k);
  assert.equal(ok.status, 200);
  const role = (u) => row(d1, 'SELECT role FROM academy_members WHERE academy_id = ? AND user_id = ?', A, u).role;
  assert.deepEqual([role('adm'), role('dono')], ['owner', 'admin']);
  assert.equal(code(await tr('dono', { toUid: 'adm', confirm: true }, k)), 'forbidden_role');             // repetir depois: quem transferiu já não é dono (a autorização vem antes da idempotência)
  assert.equal(audit(d1, 'ownership.transferred').length, 1);
  assert.equal(code(await tr('dono', { toUid: 'prof', confirm: true })), 'forbidden_role');              // o antigo dono já não pode
});
