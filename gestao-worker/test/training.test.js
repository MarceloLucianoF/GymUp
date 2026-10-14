import test from 'node:test';
import { A, B, accept, api, assert, audit, code, count, data, key, resetRateLimit, row, world } from './kit.js';

test.beforeEach(() => resetRateLimit());
const EX = [{ name: 'Agachamento', muscleGroup: 'pernas', sets: '3', reps: '10', rest: 60, machineImage: '' }, { name: 'Leg Press', sets: '4', reps: '8-12', rest: 90 }];
const T = (aid = A) => `/v1/academies/${aid}/trainings`;
const make = async (d1, uid = 'dono', body = { name: 'Perna A', exercises: EX }) => data(await api(d1, uid, 'POST', T(), { body })).templateId;
const link = async (d1, student = 'alu', coach = 'prof') => {
  const id = data(await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: student, coachUid: coach }, key: key() })).assignmentId;
  await api(d1, student, 'POST', `/v1/coach-assignments/${id}/accept`, { body: {} });
};

test('criar e publicar: rascunho vira versão imutável com hash; só dono, admin e coach com permissão', async () => {
  const d1 = world();
  const id = await make(d1);
  assert.equal(row(d1, 'SELECT current_version FROM training_templates WHERE id = ?', id).current_version, 0);
  const pub = await api(d1, 'adm', 'POST', `${T()}/${id}/publish`, { body: {} });
  assert.equal(pub.status, 200);
  assert.deepEqual([data(pub).version, data(pub).versionHash.length], [1, 64]);
  assert.equal((await api(d1, 'dono', 'POST', `${T()}/${id}/publish`, { body: {} })).status, 200);   // publicar de novo gera a versão 2
  assert.equal(data(await api(d1, 'dono', 'GET', T())).templates[0].currentVersion, 2);
  assert.throws(() => d1.raw.prepare("UPDATE training_versions SET name = 'x'").run(), /immutable_version/);
  for (const uid of ['rec', 'alu']) assert.equal(code(await api(d1, uid, 'POST', T(), { body: { name: 'Nao pode', exercises: EX } })), 'forbidden_role', uid);
  assert.equal(code(await api(d1, 'prof', 'POST', T(), { body: { name: 'Sem permissão', exercises: EX } })), 'forbidden_role');
  d1.raw.prepare("UPDATE academy_members SET can_create_trainings = 1 WHERE academy_id = ? AND user_id = 'prof'").run(A);
  assert.equal((await api(d1, 'prof', 'POST', T(), { body: { name: 'Com permissão', exercises: EX } })).status, 200);
  assert.deepEqual(['training.created', 'training.published'].map((a) => audit(d1, a).length), [2, 2]);
  assert.equal(data(await api(d1, 'dono', 'GET', T())).templates.length, 2);
});

test('criar: esquema fechado, no máximo 20 exercícios, campos limitados', async () => {
  const d1 = world();
  const bad = [
    { name: 'x', exercises: EX }, { name: 'Ok', exercises: [] }, { name: 'Ok', exercises: Array(21).fill(EX[0]) }, { name: 'Ok', exercises: [{ name: 'A', sets: '3', reps: '10' }] },
    { name: 'Ok', exercises: [{ ...EX[0], rest: 301 }] }, { name: 'Ok', exercises: [{ ...EX[0], extra: 1 }] }, { name: 'Ok', exercises: EX, academyId: B }, { name: 'Ok', exercises: EX, createdBy: 'x' }
  ];
  for (const body of bad) assert.equal((await api(d1, 'dono', 'POST', T(), { body })).status, 400, JSON.stringify(body).slice(0, 60));
  assert.equal((await api(d1, 'dono', 'POST', T(), { body: { name: 'Ok', exercises: Array(20).fill(EX[0]) } })).status, 200);
  assert.equal(count(d1, 'training_templates'), 1);
});

test('atribuir: dono e admin a qualquer aluno ativo; coach só a aluno com vínculo ativo e aceito; versão exata; reatribuir troca o assignment_id', async () => {
  const d1 = world();
  const id = await make(d1);
  await api(d1, 'dono', 'POST', `${T()}/${id}/publish`, { body: {} });
  const assign = (uid, body) => api(d1, uid, 'POST', `${T()}/${id}/assign`, { body });
  assert.equal((await assign('adm', { studentUid: 'alu' })).status, 200);
  const first = row(d1, "SELECT assignment_id, version FROM training_assignments WHERE student_uid = 'alu'");
  assert.equal(code(await assign('prof', { studentUid: 'alu2' })), 'forbidden_role');   // coach sem vínculo
  await link(d1, 'alu2', 'prof');
  assert.equal((await assign('prof', { studentUid: 'alu2' })).status, 200);
  for (const uid of ['rec', 'alu']) assert.equal(code(await assign(uid, { studentUid: 'alu' })), 'forbidden_role', uid);
  assert.equal(code(await assign('dono', { studentUid: 'prof' })), 'conflict');          // "aluno" que é coach
  assert.equal(code(await assign('dono', { studentUid: 'aluB' })), 'not_found');         // aluno de outra academia
  assert.equal(code(await assign('dono', { studentUid: 'alu', version: 5 })), 'conflict');
  assert.equal((await assign('dono', { studentUid: 'alu', version: 1 })).status, 200);
  assert.notEqual(row(d1, "SELECT assignment_id FROM training_assignments WHERE student_uid = 'alu'").assignment_id, first.assignment_id);
  assert.equal(audit(d1, 'training.assigned').length, 3);
});

test('o aluno lê a versão EXATA atribuída (nunca a mais nova, nunca o rascunho) com hash e id para o snapshot offline', async () => {
  const d1 = world();
  const id = await make(d1);
  const v1 = data(await api(d1, 'dono', 'POST', `${T()}/${id}/publish`, { body: {} }));
  await api(d1, 'dono', 'POST', `${T()}/${id}/assign`, { body: { studentUid: 'alu' } });
  d1.raw.prepare("UPDATE training_templates SET draft_json = ? WHERE id = ?").run(JSON.stringify({ exercises: [{ name: 'Rascunho secreto', sets: '1', reps: '1', rest: 0 }] }), id);
  await api(d1, 'dono', 'POST', `${T()}/${id}/publish`, { body: {} });                    // versão 2 publicada
  const t = data(await api(d1, 'alu', 'GET', `/v1/me/academies/${A}/training`)).training;
  assert.deepEqual([t.version, t.versionHash, t.trainingVersionId, t.name], [1, v1.versionHash, `${id}_1`, 'Perna A']);
  assert.deepEqual(t.exercises.map((e) => e.name), ['Agachamento', 'Leg Press']);
  assert.ok(t.assignmentId.length >= 16 && !JSON.stringify(t).includes('Rascunho secreto'));
  assert.deepEqual(Object.keys(t).sort(), ['academyId', 'assignedAt', 'assignmentId', 'description', 'exercises', 'name', 'trainingVersionId', 'version', 'versionHash']);
  assert.deepEqual(data(await api(d1, 'alu2', 'GET', `/v1/me/academies/${A}/training`)), { training: null });   // sem ficha atribuída
  for (const uid of ['dono', 'prof', 'rec']) assert.equal(code(await api(d1, uid, 'GET', `/v1/me/academies/${A}/training`)), 'forbidden_role', uid);
  assert.equal(code(await api(d1, 'alu', 'GET', `/v1/me/academies/${B}/training`)), 'no_membership');
  // ficha arquivada continua para quem já usa, mas não recebe novas atribuições
  d1.raw.prepare("UPDATE training_templates SET status = 'archived' WHERE id = ?").run(id);
  assert.ok(data(await api(d1, 'alu', 'GET', `/v1/me/academies/${A}/training`)).training);
  assert.equal(code(await api(d1, 'dono', 'POST', `${T()}/${id}/assign`, { body: { studentUid: 'alu2' } })), 'conflict');
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/members/alu/suspend`, { body: {} });
  assert.equal(code(await api(d1, 'alu', 'GET', `/v1/me/academies/${A}/training`)), 'membership_inactive');
  assert.ok(accept && B);
});
