import test from 'node:test';
import { A, T0, DAY, api, assert, audit, code, count, data, key, makeInvite, accept, resetRateLimit, row, rows, seedMember, world } from './kit.js';

test.beforeEach(() => resetRateLimit());
const M = (uid) => `/v1/academies/${A}/members/${uid}`;
const st = (d1, uid) => row(d1, 'SELECT role, status, removed_by FROM academy_members WHERE academy_id = ? AND user_id = ?', A, uid);

test('lista de membros: dono e admin veem todos; recepção só alunos; coach, aluno e estranho não listam', async () => {
  const d1 = world();
  const all = data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/members`));
  assert.equal(all.total, 8);
  assert.deepEqual(Object.keys(all.members[0]).sort(), ['coach', 'displayName', 'joinedAt', 'openAssignment', 'role', 'status', 'userId']);
  assert.ok(all.members.every((m) => m.openAssignment === null || (m.openAssignment.status && m.openAssignment.assignmentId)));
  assert.ok(!JSON.stringify(all).includes('@'));
  assert.equal(data(await api(d1, 'adm', 'GET', `/v1/academies/${A}/members`)).total, 8);
  const rec = data(await api(d1, 'rec', 'GET', `/v1/academies/${A}/members`));
  assert.ok(rec.members.every((m) => m.role === 'student') && rec.total === 2);
  assert.equal(code(await api(d1, 'rec', 'GET', `/v1/academies/${A}/members?role=coach`)), 'forbidden_role');
  for (const uid of ['prof', 'alu']) assert.equal(code(await api(d1, uid, 'GET', `/v1/academies/${A}/members`)), 'forbidden_role', uid);
  assert.equal(code(await api(d1, 'estranho', 'GET', `/v1/academies/${A}/members`)), 'no_membership');
});

test('lista de membros: filtros por papel, status, professor e nome; paginação; parâmetros inválidos são erro', async () => {
  const d1 = world();
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: 'alu', coachUid: 'prof' }, key: key() });
  const id = row(d1, "SELECT id FROM coach_assignments WHERE student_uid = 'alu'").id;
  await api(d1, 'alu', 'POST', `/v1/coach-assignments/${id}/accept`, { body: {} });
  const get = async (q) => data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/members${q}`));
  assert.equal((await get('?role=coach')).total, 3);
  assert.equal((await get('?status=suspended')).members[0].userId, 'susp');
  const withCoach = (await get('?coach=prof')).members;
  assert.deepEqual(withCoach.map((m) => [m.userId, m.coach.userId]), [['alu', 'prof']]);
  assert.equal(withCoach[0].coach.assignmentId, id);
  assert.deepEqual((await get('?coach=none')).members.map((m) => m.userId), ['alu2']);
  assert.deepEqual((await get('?q=ALU2')).members.map((m) => m.userId), ['alu2']);               // busca por nome, sem diferenciar caixa
  assert.equal((await get('?q=%25')).total, 0);                                                    // o curinga do usuário não vira padrão
  const p1 = await get('?pageSize=3&page=1'); const p3 = await get('?pageSize=3&page=3');
  assert.deepEqual([p1.members.length, p3.members.length, p1.total], [3, 2, 8]);
  for (const bad of ['?role=chefe', '?status=x', '?pageSize=51', '?pageSize=0', '?page=0', '?page=abc', '?coach=a%20b']) assert.equal(code(await api(d1, 'dono', 'GET', `/v1/academies/${A}/members${bad}`)), 'invalid_request', bad);
});

test('papel: dono muda qualquer um, exceto dono e a si mesmo; admin só coach, recepção e aluno, sem promover; ninguém vira dono por aqui', async () => {
  const d1 = world();
  const role = (uid, target, r) => api(d1, uid, 'PATCH', `${M(target)}/role`, { body: { role: r } });
  assert.equal((await role('dono', 'prof', 'reception')).status, 200);
  assert.equal(st(d1, 'prof').role, 'reception');
  assert.equal((await role('dono', 'rec', 'admin')).status, 200);
  assert.equal((await role('adm', 'prof2', 'reception')).status, 200);
  assert.equal(code(await role('adm', 'prof2', 'admin')), 'forbidden_role');         // admin não promove a admin
  assert.equal(code(await role('adm', 'dono', 'coach')), 'forbidden_role');          // nem altera dono
  assert.equal(code(await role('adm', 'rec', 'coach')), 'forbidden_role');           // rec agora é admin
  assert.equal(code(await role('adm', 'adm', 'coach')), 'forbidden_role');           // nem o próprio papel
  assert.equal(code(await role('dono', 'dono', 'admin')), 'forbidden_role');
  assert.equal(code(await role('dono', 'alu', 'owner')), 'forbidden_role');          // propriedade só por transferência
  assert.equal(code(await role('dono', 'rec', 'admin')), 'conflict');                // mesmo papel
  assert.equal(code(await role('dono', 'inexistente', 'coach')), 'not_found');
  for (const uid of ['prof', 'alu']) assert.equal(code(await role(uid, 'alu2', 'coach')), 'forbidden_role', uid);   // 'prof' já virou recepção; 'rec' virou admin
  assert.equal(code(await role('estranho', 'alu', 'coach')), 'no_membership');
  assert.equal((await api(d1, 'dono', 'PATCH', `${M('alu2')}/role`, { body: { role: 'chefe' } })).status, 400);
  assert.equal((await api(d1, 'dono', 'PATCH', `${M('alu2')}/role`, { body: { role: 'coach', userId: 'x' } })).status, 400);
  const log = audit(d1, 'member.role_changed');
  assert.deepEqual(log.map((l) => l.detail), ['coach>reception', 'reception>admin', 'coach>reception']);
});

test('papel: aluno com consentimento não vira outro papel (banco recusa com conflict) e nada é auditado', async () => {
  const d1 = world();
  await api(d1, 'alu', 'PUT', `/v1/me/academies/${A}/consent`, { body: { shareAdherence: true } });
  const r = await api(d1, 'dono', 'PATCH', `${M('alu')}/role`, { body: { role: 'coach' } });
  assert.equal(code(r), 'conflict');
  assert.equal(st(d1, 'alu').role, 'student');
  assert.equal(audit(d1, 'member.role_changed').length, 0);
});

test('suspender, reativar e remover: transições, auditoria, e matriz (admin não toca dono/admin; removido só volta pelo dono)', async () => {
  const d1 = world();
  const act = (uid, target, a) => api(d1, uid, 'POST', `${M(target)}/${a}`, { body: {} });
  assert.equal((await act('dono', 'prof', 'suspend')).status, 200);
  assert.equal(st(d1, 'prof').status, 'suspended');
  assert.equal(code(await act('dono', 'prof', 'suspend')), 'conflict');              // já suspenso
  assert.equal(code(await act('dono', 'alu', 'reactivate')), 'conflict');            // ativo não reativa
  assert.equal((await act('adm', 'prof', 'reactivate')).status, 200);
  assert.equal((await act('adm', 'rec', 'suspend')).status, 200);
  assert.equal(code(await act('adm', 'dono', 'suspend')), 'forbidden_role');
  assert.equal(code(await act('adm', 'adm', 'remove')), 'forbidden_role');
  assert.equal(code(await act('dono', 'dono', 'suspend')), 'forbidden_role');
  for (const uid of ['prof', 'alu']) assert.equal(code(await act(uid, 'alu2', 'remove')), 'forbidden_role', uid);
  assert.equal(code(await act('rec', 'alu2', 'remove')), 'membership_inactive');                // recepção suspensa pelo admin não age
  assert.equal((await act('adm', 'alu', 'remove')).status, 200);
  const removed = st(d1, 'alu');
  assert.deepEqual([removed.status, removed.removed_by], ['removed', 'adm']);
  assert.equal(code(await act('adm', 'alu', 'reactivate')), 'forbidden_role');       // admin não reativa removido
  assert.equal(code(await act('adm', 'alu', 'remove')), 'forbidden_role');
  assert.equal((await act('dono', 'alu', 'reactivate')).status, 200);
  assert.deepEqual([st(d1, 'alu').status, st(d1, 'alu').removed_by], ['active', null]);
  assert.deepEqual(['member.suspended', 'member.reactivated', 'member.removed'].map((a) => audit(d1, a).length), [2, 2, 1]);
  assert.equal(code(await act('estranho', 'alu', 'suspend')), 'no_membership');
  assert.equal(code(await act('dono', 'inexistente', 'suspend')), 'not_found');
  assert.equal((await api(d1, 'dono', 'POST', `${M('alu2')}/suspend`, { body: { role: 'owner' } })).status, 400);
});

test('remover o aluno revoga professor e consentimento; remover o coach revoga os vínculos dele', async () => {
  const d1 = world();
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: 'alu', coachUid: 'prof' }, key: key() });
  const id = row(d1, 'SELECT id FROM coach_assignments').id;
  await api(d1, 'alu', 'POST', `/v1/coach-assignments/${id}/accept`, { body: {} });
  await api(d1, 'alu', 'PUT', `/v1/me/academies/${A}/consent`, { body: { shareAdherence: true } });
  await api(d1, 'adm', 'POST', `${M('alu')}/remove`, { body: {} });
  assert.equal(row(d1, 'SELECT status FROM coach_assignments WHERE id = ?', id).status, 'revoked');
  assert.equal(row(d1, "SELECT status FROM academy_consents WHERE student_uid = 'alu'").status, 'revoked');
  const id2 = (await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: 'alu2', coachUid: 'prof2' }, key: key() })).json.data.assignmentId;
  await api(d1, 'dono', 'POST', `${M('prof2')}/remove`, { body: {} });
  assert.equal(row(d1, 'SELECT status FROM coach_assignments WHERE id = ?', id2).status, 'revoked');
});

test('último dono: não suspende, não remove, não sai; com dois donos o segundo pode ser removido pelo primeiro', async () => {
  const d1 = world();
  assert.equal((await api(d1, 'dono', 'POST', `/v1/me/academies/${A}/leave`, { body: {} })).status, 409);
  assert.equal(code(await api(d1, 'dono', 'POST', `/v1/me/academies/${A}/leave`, { body: {} })), 'last_owner');
  assert.equal(st(d1, 'dono').status, 'active');
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/transfer-ownership`, { body: { toUid: 'adm', confirm: true }, key: key() });
  // agora 'adm' é o único dono e 'dono' virou admin
  assert.equal(code(await api(d1, 'adm', 'POST', `/v1/me/academies/${A}/leave`, { body: {} })), 'last_owner');
  assert.equal(code(await api(d1, 'dono', 'POST', `${M('adm')}/remove`, { body: {} })), 'forbidden_role');
  // o banco protege mesmo se o Worker errasse a matriz
  assert.throws(() => d1.raw.prepare("UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = 'x' WHERE academy_id = ? AND user_id = 'adm'").run('2026-10-14T00:00:00.000Z', A), /last_owner/);
});

test('sair: só quem está ativo; suspenso não sai nem volta por convite; quem saiu volta sem permissões antigas; consentimento e vínculo são revogados', async () => {
  const d1 = world();
  assert.equal(code(await api(d1, 'susp', 'POST', `/v1/me/academies/${A}/leave`, { body: {} })), 'membership_inactive');
  assert.equal(st(d1, 'susp').status, 'suspended');
  const inv = await makeInvite(d1, 'dono', 'student', { maxUses: 5 });
  assert.equal(code(await accept(d1, 'susp', inv.code)), 'conflict');
  d1.raw.prepare("UPDATE academy_members SET can_create_trainings = 1, branch_id = 'filial1' WHERE academy_id = ? AND user_id = 'prof'").run(A);
  assert.equal((await api(d1, 'prof', 'POST', `/v1/me/academies/${A}/leave`, { body: {} })).status, 200);
  assert.deepEqual([st(d1, 'prof').status, st(d1, 'prof').removed_by], ['removed', 'prof']);
  assert.equal(code(await api(d1, 'prof', 'GET', `/v1/academies/${A}`)), 'no_membership');
  assert.equal(code(await api(d1, 'prof', 'POST', `/v1/me/academies/${A}/leave`, { body: {} })), 'no_membership');
  assert.equal((await accept(d1, 'prof', inv.code)).status, 200);                    // saída voluntária pode voltar por convite
  const back = row(d1, "SELECT role, can_create_trainings, branch_id, removed_by, removed_at FROM academy_members WHERE academy_id = ? AND user_id = 'prof'", A);
  assert.deepEqual([back.role, back.can_create_trainings, back.branch_id, back.removed_by, back.removed_at], ['student', 0, null, null, null]);
  // removido pela equipe NÃO volta por convite
  await api(d1, 'adm', 'POST', `${M('alu2')}/remove`, { body: {} });
  assert.equal(code(await accept(d1, 'alu2', inv.code)), 'conflict');
  assert.equal(st(d1, 'alu2').status, 'removed');
  assert.equal(audit(d1, 'member.left').length, 1);
});

test('coach vê só os alunos com vínculo ativo e aceito, e só enquanto os dois lados estão ativos', async () => {
  const d1 = world();
  const students = async (uid) => data(await api(d1, uid, 'GET', `/v1/academies/${A}/coach/students`));
  assert.deepEqual((await students('prof')).students, []);
  const pr = await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: 'alu', coachUid: 'prof' }, key: key() });
  assert.deepEqual((await students('prof')).students, []);                           // proposto, antes do aceite: invisível
  await api(d1, 'alu', 'POST', `/v1/coach-assignments/${data(pr).assignmentId}/accept`, { body: {} });
  const list = (await students('prof')).students;
  assert.deepEqual(list.map((s) => [s.userId, s.displayName]), [['alu', 'Nome alu']]);
  assert.deepEqual(Object.keys(list[0]).sort(), ['displayName', 'since', 'userId']);   // nunca dado de saúde
  assert.deepEqual((await students('prof2')).students, []);                          // outro coach não vê
  await api(d1, 'adm', 'POST', `${M('alu')}/suspend`, { body: {} });
  assert.deepEqual((await students('prof')).students, []);                           // aluno suspenso
  await api(d1, 'adm', 'POST', `${M('alu')}/reactivate`, { body: {} });
  assert.equal((await students('prof')).students.length, 1);
  await api(d1, 'adm', 'POST', `${M('prof')}/suspend`, { body: {} });
  assert.equal(code(await api(d1, 'prof', 'GET', `/v1/academies/${A}/coach/students`)), 'membership_inactive');   // professor suspenso não acessa aluno
  for (const uid of ['alu', 'rec', 'dono']) assert.equal(code(await api(d1, uid, 'GET', `/v1/academies/${A}/coach/students`)), 'forbidden_role', uid);
});

test('alteração concorrente: o rebaixamento de outro dono não é sobrescrito e ator suspenso no meio não conclui', async () => {
  const d1 = world();
  const real = d1.batch.bind(d1);
  let once = true;
  d1.batch = async (stmts) => {
    if (once && stmts[0].sql.includes("UPDATE academy_members SET status = 'suspended'")) { once = false; d1.raw.prepare("UPDATE academy_members SET role = 'reception' WHERE user_id = 'prof' AND academy_id = ?").run(A); }
    return real(stmts);
  };
  const r = await api(d1, 'dono', 'POST', `${M('prof')}/suspend`, { body: {} });
  assert.equal(r.status, 409);
  assert.deepEqual([st(d1, 'prof').role, st(d1, 'prof').status], ['reception', 'active']);
  assert.equal(audit(d1, 'member.suspended').length, 0);
  d1.batch = async (stmts) => {
    if (stmts[0].sql.includes("UPDATE academy_members SET status = 'suspended'")) d1.raw.prepare("UPDATE academy_members SET status = 'suspended', suspended_at = '2026-10-14T00:00:00.000Z' WHERE user_id = 'adm' AND academy_id = ?").run(A);
    return real(stmts);
  };
  assert.equal((await api(d1, 'adm', 'POST', `${M('alu')}/suspend`, { body: {} })).status, 409);
  assert.equal(st(d1, 'alu').status, 'active');
  assert.ok(T0 && DAY && rows && count && seedMember);
});

test('coach vê só nomes de alunos sem professor e sem proposta para poder propor; quem tem vínculo ou proposta nunca aparece', async () => {
  const d1 = world();
  const list = async (uid) => data(await api(d1, uid, 'GET', `/v1/academies/${A}/coach/unassigned-students`)).students;
  assert.deepEqual((await list('prof')).map((s) => s.userId), ['alu', 'alu2']);
  assert.deepEqual(Object.keys((await list('prof'))[0]).sort(), ['displayName', 'userId']);
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: 'alu', coachUid: 'prof2' }, key: key() });   // proposta em aberto
  assert.deepEqual((await list('prof')).map((s) => s.userId), ['alu2']);
  seedMember(d1, A, 'aluNovo', 'student', 'suspended');
  assert.deepEqual((await list('prof')).map((s) => s.userId), ['alu2']);                // suspenso não aparece
  for (const uid of ['alu', 'rec', 'dono', 'adm']) assert.equal(code(await api(d1, uid, 'GET', `/v1/academies/${A}/coach/unassigned-students`)), 'forbidden_role', uid);
  assert.equal(code(await api(d1, 'profB', 'GET', `/v1/academies/${A}/coach/unassigned-students`)), 'no_membership');
});
