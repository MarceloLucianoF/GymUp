import test from 'node:test';
import { A, B, api, assert, audit, code, count, data, key, resetRateLimit, row, rows, seedMember, world } from './kit.js';

test.beforeEach(() => resetRateLimit());
const propose = (d1, uid, body, aid = A) => api(d1, uid, 'POST', `/v1/academies/${aid}/coach-assignments`, { body, key: key() });
const act = (d1, uid, id, a) => api(d1, uid, 'POST', `/v1/coach-assignments/${id}/${a}`, { body: {} });
const status = (d1, id) => row(d1, 'SELECT status FROM coach_assignments WHERE id = ?', id).status;
const students = async (d1, uid, aid = A) => data(await api(d1, uid, 'GET', `/v1/academies/${aid}/coach/students`)).students.map((s) => s.userId);

test('fluxo completo: dono propõe -> aluno vê e aceita -> coach passa a ver o aluno; tudo auditado', async () => {
  const d1 = world();
  const p = await propose(d1, 'adm', { studentUid: 'alu', coachUid: 'prof' });
  assert.equal(p.status, 200);
  const id = data(p).assignmentId;
  assert.equal(data(p).status, 'pending_student');
  assert.deepEqual(await students(d1, 'prof'), []);                                   // professor não acessa aluno antes do aceite
  const mine = data(await api(d1, 'alu', 'GET', '/v1/me/coach-assignments')).assignments;
  assert.deepEqual(mine.map((a) => [a.assignmentId, a.coachName, a.status, a.academyName]), [[id, 'Nome prof', 'pending_student', 'ZZ TESTE Gestão A']]);
  assert.equal((await act(d1, 'alu', id, 'accept')).status, 200);
  assert.deepEqual(await students(d1, 'prof'), ['alu']);
  assert.equal(data(await api(d1, 'alu', 'GET', '/v1/me/coach-assignments')).assignments[0].status, 'active');
  assert.deepEqual(['coach.proposed', 'coach.accepted'].map((a) => audit(d1, a).length), [1, 1]);
  assert.equal(row(d1, 'SELECT approved_by FROM coach_assignments WHERE id = ?', id).approved_by, 'adm');
});

test('coach propõe para si mesmo, precisa de aprovação do dono/admin e nunca aprova o próprio vínculo; o aluno não vê antes da aprovação', async () => {
  const d1 = world();
  assert.equal(code(await propose(d1, 'prof', { studentUid: 'alu', coachUid: 'prof2' })), 'forbidden_role');   // não em nome de outro
  const p = await propose(d1, 'prof', { studentUid: 'alu' });
  const id = data(p).assignmentId;
  assert.deepEqual([data(p).status, data(p).coachUid], ['proposed', 'prof']);
  assert.deepEqual(data(await api(d1, 'alu', 'GET', '/v1/me/coach-assignments')).assignments, []);              // proposta não aprovada é invisível
  assert.equal(code(await act(d1, 'alu', id, 'accept')), 'conflict');                                             // aluno não pula a aprovação
  for (const uid of ['prof', 'rec', 'alu', 'estranho']) assert.equal(code(await act(d1, uid, id, 'approve')), 'not_found', uid);   // coach não aprova a si mesmo
  assert.equal((await act(d1, 'adm', id, 'approve')).status, 200);
  assert.equal(status(d1, id), 'pending_student');
  assert.equal(code(await act(d1, 'adm', id, 'approve')), 'conflict');
  assert.equal((await act(d1, 'alu', id, 'accept')).status, 200);
  assert.deepEqual(await students(d1, 'prof'), ['alu']);
  assert.equal(audit(d1, 'coach.approved').length, 1);
  const list = data(await api(d1, 'prof', 'GET', `/v1/academies/${A}/coach-assignments`)).assignments;   // coach lista só as próprias
  assert.deepEqual(list.map((a) => a.coachUid), ['prof']);
});

test('proposta: papéis e estados válidos; só uma em aberto; idempotente; coach propõe só se for coach; estranho, aluno e recepção não propõem', async () => {
  const d1 = world();
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'alu' })), 'invalid_request');                        // dono precisa dizer o coach
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'alu' })), 'invalid_request');
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'prof', coachUid: 'prof2' })), 'conflict');           // "aluno" que é coach
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'adm' })), 'conflict');              // "coach" que é admin
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'susp' })), 'conflict');             // coach suspenso
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'inexistente' })), 'not_found');
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'aluB', coachUid: 'prof' })), 'not_found');           // aluno de outra academia
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof', role: 'x' })), 'invalid_request');
  for (const uid of ['rec', 'alu', 'estranho']) assert.ok(['forbidden_role', 'no_membership'].includes(code(await propose(d1, uid, { studentUid: 'alu2', coachUid: 'prof' }))), uid);
  const k = key();
  const body = { studentUid: 'alu', coachUid: 'prof' };
  const first = await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body, key: k });
  const repeat = await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body, key: k });
  assert.deepEqual(data(repeat), data(first));
  assert.equal(count(d1, 'coach_assignments'), 1);
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof2' })), 'conflict');           // já há proposta em aberto
  assert.equal(code(await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: 'alu', coachUid: 'prof2' }, key: k })), 'conflict');   // mesma chave, corpo diferente
});

test('transferência: aceitar o novo professor revoga o anterior na MESMA transação; o antigo perde o acesso na hora', async () => {
  const d1 = world();
  const a1 = data(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof' })).assignmentId;
  await act(d1, 'alu', a1, 'accept');
  assert.deepEqual(await students(d1, 'prof'), ['alu']);
  const a2 = data(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof2' })).assignmentId;               // proposta nova com ativo é permitida
  assert.deepEqual(await students(d1, 'prof'), ['alu']);                                                           // até o aceite, o antigo continua
  assert.equal((await act(d1, 'alu', a2, 'accept')).status, 200);
  assert.deepEqual([status(d1, a1), status(d1, a2)], ['revoked', 'active']);
  assert.deepEqual([await students(d1, 'prof'), await students(d1, 'prof2')], [[], ['alu']]);                      // acesso anterior revogado
  assert.equal(count(d1, 'coach_assignments', "WHERE student_uid = 'alu' AND status = 'active'"), 1);
  assert.equal(audit(d1, 'coach.revoked')[0].detail, 'transferencia');
  assert.equal(code(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof2' })), 'conflict');             // já é o professor
});

test('recusar: aluno recusa o que espera por ele; dono/admin recusam proposta de coach; coach e estranho não; final', async () => {
  const d1 = world();
  const a = data(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof' })).assignmentId;
  for (const uid of ['prof', 'alu2', 'estranho', 'rec']) assert.equal(code(await act(d1, uid, a, 'reject')), 'not_found', uid);
  assert.equal((await act(d1, 'alu', a, 'reject')).status, 200);
  assert.equal(status(d1, a), 'rejected');
  assert.equal(code(await act(d1, 'alu', a, 'accept')), 'conflict');                                               // recusado é final
  assert.equal(code(await act(d1, 'alu', a, 'reject')), 'conflict');
  const b = data(await propose(d1, 'prof2', { studentUid: 'alu2' })).assignmentId;
  assert.equal(code(await act(d1, 'alu2', b, 'reject')), 'conflict');                                              // aluno não recusa o que ainda não é dele
  assert.equal((await act(d1, 'adm', b, 'reject')).status, 200);
  assert.equal(audit(d1, 'coach.rejected').length, 2);
});

test('encerrar: dono/admin, o aluno e o próprio coach encerram; outros não; encerrado tira o acesso do coach e é final', async () => {
  const d1 = world();
  const mk = async (s, c) => { const id = data(await propose(d1, 'dono', { studentUid: s, coachUid: c })).assignmentId; await act(d1, s, id, 'accept'); return id; };
  const a = await mk('alu', 'prof');
  for (const uid of ['prof2', 'rec', 'estranho', 'alu2']) assert.equal(code(await act(d1, uid, a, 'revoke')), 'not_found', uid);
  assert.equal((await act(d1, 'prof', a, 'revoke')).status, 200);                   // o próprio coach encerra
  assert.deepEqual(await students(d1, 'prof'), []);
  assert.equal(code(await act(d1, 'adm', a, 'revoke')), 'conflict');                // já encerrado
  const b = await mk('alu', 'prof2');
  assert.equal((await act(d1, 'alu', b, 'revoke')).status, 200);                    // o aluno encerra
  const c = await mk('alu2', 'prof2');
  assert.equal((await act(d1, 'adm', c, 'revoke')).status, 200);                    // o admin encerra
  assert.deepEqual(audit(d1, 'coach.revoked').map((l) => l.detail), ['coach', 'student', 'staff']);
});

test('professor suspenso ou rebaixado não acessa aluno; reativar não ressuscita vínculo encerrado', async () => {
  const d1 = world();
  const a = data(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof' })).assignmentId;
  await act(d1, 'alu', a, 'accept');
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/members/prof/suspend`, { body: {} });
  assert.equal(code(await api(d1, 'prof', 'GET', `/v1/academies/${A}/coach/students`)), 'membership_inactive');
  assert.equal(code(await act(d1, 'prof', a, 'revoke')), 'not_found');              // suspenso nem encerra
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/members/prof/reactivate`, { body: {} });
  assert.deepEqual(await students(d1, 'prof'), ['alu']);                             // suspender é reversível: o vínculo continua
  await api(d1, 'dono', 'PATCH', `/v1/academies/${A}/members/prof/role`, { body: { role: 'reception' } });
  assert.equal(status(d1, a), 'revoked');                                            // deixar de ser coach revoga
  await api(d1, 'dono', 'PATCH', `/v1/academies/${A}/members/prof/role`, { body: { role: 'coach' } });
  assert.deepEqual(await students(d1, 'prof'), []);                                  // voltar a ser coach não ressuscita
});

test('o aceite exige os dois lados ativos: aluno ou coach suspenso entre a proposta e o aceite bloqueia', async () => {
  const d1 = world();
  const a = data(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof' })).assignmentId;
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/members/prof/suspend`, { body: {} });
  assert.equal(code(await act(d1, 'alu', a, 'accept')), 'conflict');                 // coach suspenso: o banco recusa a ativação
  assert.equal(status(d1, a), 'pending_student');
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/members/prof/reactivate`, { body: {} });
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/members/alu/suspend`, { body: {} });
  assert.equal(code(await act(d1, 'alu', a, 'accept')), 'not_found');                // aluno suspenso nem acessa
});

test('consentimento: só o próprio aluno concede e revoga; revogar é auditado; sair revoga; repetir é inofensivo; sem aderência no painel', async () => {
  const d1 = world();
  const put = (uid, v) => api(d1, uid, 'PUT', `/v1/me/academies/${A}/consent`, { body: { shareAdherence: v } });
  const get = (uid) => api(d1, uid, 'GET', `/v1/me/academies/${A}/consent`);
  assert.deepEqual(data(await get('alu')), { academyId: A, shareAdherence: false, status: 'none', grantedAt: null, revokedAt: null });
  assert.equal((await put('alu', true)).status, 200);
  assert.deepEqual([data(await get('alu')).shareAdherence, data(await get('alu')).status], [true, 'granted']);
  assert.equal(data(await put('alu', true)).unchanged, true);                       // repetir não duplica nem audita
  assert.equal((await put('alu', false)).status, 200);
  assert.deepEqual([data(await get('alu')).shareAdherence, data(await get('alu')).status], [false, 'revoked']);
  assert.equal(data(await put('alu', false)).unchanged, true);
  assert.equal((await put('alu', true)).status, 200);                               // concede de novo depois de revogar
  assert.deepEqual(['consent.granted', 'consent.revoked'].map((a) => audit(d1, a).length), [2, 1]);
  for (const uid of ['dono', 'adm', 'prof', 'rec']) { assert.equal(code(await put(uid, true)), 'forbidden_role', uid); assert.equal(code(await get(uid)), 'forbidden_role', uid); }
  assert.equal(code(await put('estranho', true)), 'no_membership');
  assert.equal((await api(d1, 'alu', 'PUT', `/v1/me/academies/${A}/consent`, { body: { shareAdherence: true, studentUid: 'alu2' } })).status, 400);
  assert.equal((await api(d1, 'alu', 'PUT', `/v1/me/academies/${A}/consent`, { body: { shareAdherence: 'sim' } })).status, 400);
  // o consentimento de um aluno não afeta o de outro nem aparece em nenhuma tela da gestão
  assert.equal(data(await get('alu2')).status, 'none');
  for (const path of [`/v1/academies/${A}/members`, `/v1/academies/${A}/dashboard`, `/v1/academies/${A}/audit`]) assert.ok(!/adherence|consent_|shareAdherence/i.test(JSON.stringify((await api(d1, 'dono', 'GET', path)).json.data).replace(/consent\.(granted|revoked)/g, '')), path);
  await api(d1, 'alu', 'POST', `/v1/me/academies/${A}/leave`, { body: {} });
  assert.equal(row(d1, "SELECT status FROM academy_consents WHERE student_uid = 'alu'").status, 'revoked');   // sair revoga
  assert.ok(B && rows && seedMember);
});
