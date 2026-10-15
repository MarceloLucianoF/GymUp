import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { A, B, api, assert, audit, code, count, data, key, resetRateLimit, row, rows, world } from './kit.js';
import { MIGRATIONS } from './helpers.js';
import { diffExercises } from '../src/handlers/training.js';

test.beforeEach(() => resetRateLimit());
const EX = [{ name: 'Agachamento', muscleGroup: 'pernas', sets: '3', reps: '10', rest: 60 }, { name: 'Leg Press', sets: '4', reps: '8-12', rest: 90 }];
const T = (aid = A) => `/v1/academies/${aid}/trainings`;
const make = async (d1, uid = 'dono', body = { name: 'Perna A', exercises: EX }, aid = A) => data(await api(d1, uid, 'POST', T(aid), { body })).templateId;
const publish = (d1, id, uid = 'dono', aid = A) => api(d1, uid, 'POST', `${T(aid)}/${id}/publish`, { body: {} });
const link = async (d1, student, coach) => {
  const id = data(await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: student, coachUid: coach }, key: key() })).assignmentId;
  await api(d1, student, 'POST', `/v1/coach-assignments/${id}/accept`, { body: {} });
};
const canCreate = (d1, uid) => d1.raw.prepare("UPDATE academy_members SET can_create_trainings = 1 WHERE academy_id = ? AND user_id = ?").run(A, uid);

test('lista e detalhe: dono, admin e qualquer professor leem; recepção e aluno não; outra academia não enxerga', async () => {
  const d1 = world();
  const id = await make(d1);
  for (const uid of ['dono', 'adm', 'prof']) assert.equal((await api(d1, uid, 'GET', T())).status, 200, uid);
  for (const uid of ['rec', 'alu']) assert.equal(code(await api(d1, uid, 'GET', T())), 'forbidden_role', uid);
  assert.equal(code(await api(d1, 'prof', 'GET', `${T()}/${id}`)), undefined);
  assert.equal(code(await api(d1, 'donoB', 'GET', `${T(A)}/${id}`)), 'no_membership');          // dono de B na URL de A
  assert.equal(code(await api(d1, 'donoB', 'GET', `${T(B)}/${id}`)), 'not_found');               // id de A na URL de B
  assert.equal(data(await api(d1, 'donoB', 'GET', T(B))).templates.length, 0);
  assert.equal(data(await api(d1, 'prof', 'GET', T())).templates[0].assignedCount, undefined);   // professor não vê contagens
});

test('detalhe mostra mudança não publicada e a linha do tempo de versões', async () => {
  const d1 = world();
  const id = await make(d1);
  let d = data(await api(d1, 'dono', 'GET', `${T()}/${id}`));
  assert.deepEqual([d.template.unpublishedChanges, d.versions.length, d.template.exercises.length], [true, 0, 2]);
  await publish(d1, id);
  d = data(await api(d1, 'dono', 'GET', `${T()}/${id}`));
  assert.deepEqual([d.template.unpublishedChanges, d.versions.length, d.versions[0].version, d.versions[0].versionHash.length], [false, 1, 1, 64]);
  await api(d1, 'dono', 'PATCH', `${T()}/${id}`, { body: { description: 'novo texto' } });
  assert.equal(data(await api(d1, 'dono', 'GET', `${T()}/${id}`)).template.unpublishedChanges, true);
  assert.equal(data(await api(d1, 'dono', 'GET', `${T()}/${id}/versions/1`)).exercises.length, 2);
  assert.equal(code(await api(d1, 'dono', 'GET', `${T()}/${id}/versions/9`)), 'not_found');
  assert.equal(code(await api(d1, 'dono', 'GET', `${T()}/${id}/versions/abc`)), 'not_found');
});

test('editar rascunho: versão publicada não muda; professor só edita a própria; campos fechados; auditado', async () => {
  const d1 = world();
  canCreate(d1, 'prof'); canCreate(d1, 'prof2');
  const own = await make(d1, 'prof'), other = await make(d1, 'dono');
  await publish(d1, own, 'prof');
  const patch = (uid, id, body) => api(d1, uid, 'PATCH', `${T()}/${id}`, { body });
  assert.equal((await patch('prof', own, { name: 'Perna B', exercises: [EX[0]] })).status, 200);
  assert.equal(row(d1, 'SELECT name, exercises_json FROM training_versions WHERE template_id = ?', own).name, 'Perna A');   // versão 1 intacta
  assert.equal(JSON.parse(row(d1, 'SELECT draft_json d FROM training_templates WHERE id = ?', own).d).exercises.length, 1);
  assert.equal(code(await patch('prof', other, { name: 'Invadindo' })), 'forbidden_role');
  assert.equal(code(await patch('prof2', own, { name: 'Invadindo' })), 'forbidden_role');
  assert.equal((await patch('adm', own, { name: 'Admin edita' })).status, 200);
  for (const uid of ['rec', 'alu']) assert.equal(code(await patch(uid, own, { name: 'x1' })), 'forbidden_role', uid);
  for (const body of [{}, { academyId: B }, { name: 'x' }, { exercises: [] }, { createdBy: 'x' }, { currentVersion: 9 }]) assert.equal((await patch('dono', own, body)).status, 400, JSON.stringify(body));
  assert.equal(code(await api(d1, 'donoB', 'PATCH', `${T(B)}/${own}`, { body: { name: 'Cruzando' } })), 'not_found');
  assert.equal(audit(d1, 'training.updated').length, 2);
});

test('duplicar: cópia nova em rascunho, mesmo conteúdo, dono é quem duplica; não cruza academias', async () => {
  const d1 = world();
  const id = await make(d1);
  await publish(d1, id);
  const r = await api(d1, 'adm', 'POST', `${T()}/${id}/duplicate`, { body: {} });
  assert.equal(r.status, 200);
  const copy = data(r).templateId;
  assert.notEqual(copy, id);
  const c = row(d1, 'SELECT name, current_version, status, created_by, draft_json FROM training_templates WHERE id = ?', copy);
  assert.deepEqual([c.name, c.current_version, c.status, c.created_by], ['Perna A (cópia)', 0, 'active', 'adm']);
  assert.equal(c.draft_json, row(d1, 'SELECT draft_json FROM training_templates WHERE id = ?', id).draft_json);
  assert.equal((await api(d1, 'dono', 'POST', `${T()}/${id}/duplicate`, { body: { name: 'Nome escolhido' } })).status, 200);
  assert.equal(code(await api(d1, 'donoB', 'POST', `${T(B)}/${id}/duplicate`, { body: {} })), 'not_found');
  assert.equal(code(await api(d1, 'prof', 'POST', `${T()}/${id}/duplicate`, { body: {} })), 'forbidden_role');   // sem permissão de criar
  assert.equal(audit(d1, 'training.duplicated').length, 2);
});

test('arquivar e restaurar: arquivada não recebe atribuição nem edição; quem já tem continua; restaurar reabre', async () => {
  const d1 = world();
  canCreate(d1, 'prof');
  const id = await make(d1);
  await publish(d1, id);
  await api(d1, 'dono', 'POST', `${T()}/${id}/assign`, { body: { studentUid: 'alu' } });
  assert.equal(code(await api(d1, 'prof', 'POST', `${T()}/${id}/archive`, { body: {} })), 'forbidden_role');   // não é dela
  assert.equal((await api(d1, 'adm', 'POST', `${T()}/${id}/archive`, { body: {} })).status, 200);
  assert.equal(code(await api(d1, 'adm', 'POST', `${T()}/${id}/archive`, { body: {} })), 'conflict');           // já arquivada
  assert.equal(code(await api(d1, 'dono', 'POST', `${T()}/${id}/assign`, { body: { studentUid: 'alu2' } })), 'conflict');
  assert.equal(code(await api(d1, 'dono', 'PATCH', `${T()}/${id}`, { body: { name: 'Editando arquivada' } })), 'conflict');
  assert.equal(code(await publish(d1, id)), 'conflict');
  assert.equal(count(d1, 'training_assignments', "WHERE student_uid = 'alu'"), 1);                              // quem já tem continua
  assert.equal(data(await api(d1, 'alu', 'GET', `/v1/me/academies/${A}/training`)).training.name, 'Perna A');
  assert.equal(data(await api(d1, 'dono', 'GET', `${T()}?status=archived`)).templates.length, 1);
  assert.equal(data(await api(d1, 'dono', 'GET', `${T()}?status=active`)).templates.length, 0);
  assert.equal(code(await api(d1, 'dono', 'GET', `${T()}?status=xx`)), 'invalid_request');
  assert.equal((await api(d1, 'dono', 'POST', `${T()}/${id}/restore`, { body: {} })).status, 200);
  assert.equal(code(await api(d1, 'dono', 'POST', `${T()}/${id}/restore`, { body: {} })), 'conflict');
  assert.equal((await api(d1, 'dono', 'POST', `${T()}/${id}/assign`, { body: { studentUid: 'alu2' } })).status, 200);
  assert.deepEqual(['training.archived', 'training.restored'].map((a) => audit(d1, a).length), [1, 1]);
  assert.equal(code(await api(d1, 'donoB', 'POST', `${T(B)}/${id}/archive`, { body: {} })), 'not_found');
});

test('comparar versões: adicionado, removido, alterado, movido; rascunho contra versão', async () => {
  const d1 = world();
  const id = await make(d1);
  await publish(d1, id);
  await api(d1, 'dono', 'PATCH', `${T()}/${id}`, { body: { exercises: [{ name: 'Leg Press', sets: '5', reps: '8-12', rest: 90 }, { name: 'Cadeira Extensora', sets: '3', reps: '12', rest: 60 }] } });
  await publish(d1, id);
  const r = data(await api(d1, 'dono', 'GET', `${T()}/${id}/compare?from=1&to=2`));
  assert.deepEqual(r.summary, { added: 1, removed: 1, changed: 1, moved: 0, same: 0 });
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
  assert.deepEqual([by['Cadeira Extensora'].status, by.Agachamento.status, by['Leg Press'].status, by['Leg Press'].changes], ['added', 'removed', 'changed', ['sets']]);
  await api(d1, 'dono', 'PATCH', `${T()}/${id}`, { body: { name: 'Perna C' } });
  const d = data(await api(d1, 'dono', 'GET', `${T()}/${id}/compare?from=2&to=draft`));
  assert.deepEqual([d.nameChanged, d.summary.same], [true, 2]);
  assert.equal(code(await api(d1, 'dono', 'GET', `${T()}/${id}/compare?from=7&to=2`)), 'not_found');
  assert.equal(code(await api(d1, 'dono', 'GET', `${T()}/${id}/compare?from=x`)), 'invalid_request');
  assert.equal(code(await api(d1, 'alu', 'GET', `${T()}/${id}/compare?from=1`)), 'forbidden_role');
  assert.deepEqual(diffExercises([{ name: 'A', sets: '3', reps: '8', rest: 1 }, { name: 'B', sets: '3', reps: '8', rest: 1 }], [{ name: 'b', sets: '3', reps: '8', rest: 1 }, { name: 'A', sets: '3', reps: '8', rest: 1 }]).map((x) => x.status), ['moved', 'moved']);
});

const batch = (d1, uid, id, body, opts = {}) => api(d1, uid, 'POST', `${T()}/${id}/assign-batch`, { body, ...opts });
const ready = async (d1) => { const id = await make(d1); await publish(d1, id); return id; };

test('lote: prévia não grava nada e mostra o que acontece com cada aluno', async () => {
  const d1 = world();
  const id = await ready(d1);
  await api(d1, 'dono', 'POST', `${T()}/${id}/assign`, { body: { studentUid: 'alu2' } });
  const other = await make(d1, 'dono', { name: 'Outra', exercises: EX }); await publish(d1, other);
  await api(d1, 'dono', 'POST', `${T()}/${other}/assign`, { body: { studentUid: 'alu2' } });
  const before = count(d1, 'training_assignments'), audits = count(d1, 'academy_audit_log');
  const r = await batch(d1, 'dono', id, { studentUids: ['alu', 'alu2', 'prof', 'aluB', 'fantasma'], dryRun: true });
  assert.equal(r.status, 200);
  const by = Object.fromEntries(data(r).results.map((x) => [x.studentUid, x]));
  assert.deepEqual([by.alu.outcome, by.alu2.reason, by.prof.reason, by.aluB.reason, by.fantasma.reason], ['assign', 'has_other', 'not_active_student', 'not_found', 'not_found']);
  assert.deepEqual(data(r).summary, { assign: 1, replace: 0, skip: 4 });
  assert.deepEqual([count(d1, 'training_assignments'), count(d1, 'academy_audit_log')], [before, audits]);
  const rep = data(await batch(d1, 'dono', id, { studentUids: ['alu2'], replace: true, dryRun: true }));
  assert.deepEqual([rep.results[0].outcome, rep.results[0].current.templateId], ['replace', other]);
});

test('lote: aplica, troca só com replace, é atômico, auditado e idempotente', async () => {
  const d1 = world();
  const id = await ready(d1);
  const other = await make(d1, 'dono', { name: 'Outra', exercises: EX }); await publish(d1, other);
  await api(d1, 'dono', 'POST', `${T()}/${other}/assign`, { body: { studentUid: 'alu2' } });
  const k = key();
  const r = await batch(d1, 'adm', id, { studentUids: ['alu', 'alu2'] }, { key: k });
  assert.equal(r.status, 200);
  assert.deepEqual(data(r).summary, { assign: 1, replace: 0, skip: 1 });
  assert.equal(row(d1, "SELECT template_id t FROM training_assignments WHERE student_uid = 'alu2'").t, other);   // não trocou sem replace
  assert.equal(row(d1, "SELECT template_id t FROM training_assignments WHERE student_uid = 'alu'").t, id);
  const replay = await batch(d1, 'adm', id, { studentUids: ['alu', 'alu2'] }, { key: k });                     // mesma chave e corpo: resultado salvo
  assert.deepEqual(data(replay).summary, data(r).summary);
  assert.equal(audit(d1, 'training.batch_assigned').length, 1);
  assert.equal(code(await batch(d1, 'adm', id, { studentUids: ['alu'], replace: true }, { key: k })), 'conflict');   // mesma chave, outro corpo
  const r2 = await batch(d1, 'adm', id, { studentUids: ['alu2'], replace: true }, { key: key() });
  assert.deepEqual(data(r2).summary, { assign: 0, replace: 1, skip: 0 });
  assert.equal(row(d1, "SELECT template_id t FROM training_assignments WHERE student_uid = 'alu2'").t, id);
  assert.equal(audit(d1, 'training.assigned').length, 3);   // alu2 (individual) + alu (lote) + alu2 (troca)
  // tudo já atribuído: nada a gravar, a chave não é guardada e o resumo diz isso
  const noop = await batch(d1, 'adm', id, { studentUids: ['alu'] }, { key: key() });
  assert.deepEqual([noop.status, data(noop).summary], [200, { assign: 0, replace: 0, skip: 1 }]);
  assert.equal(audit(d1, 'training.batch_assigned').length, 2);
});

test('lote: sem Idempotency-Key a aplicação é recusada; limite de 50; esquema fechado; papéis', async () => {
  const d1 = world();
  const id = await ready(d1);
  assert.equal(code(await batch(d1, 'dono', id, { studentUids: ['alu'] })), 'idempotency_required');
  assert.equal(count(d1, 'training_assignments'), 0);
  const many = Array.from({ length: 51 }, (_, i) => `uid${i}`);
  assert.equal((await batch(d1, 'dono', id, { studentUids: many, dryRun: true })).status, 400);
  for (const body of [{}, { studentUids: [] }, { studentUids: ['alu'], academyId: B }, { studentUids: ['a b'] }, { studentUids: ['alu'], replace: 'sim' }]) assert.equal((await batch(d1, 'dono', id, body, { key: key() })).status, 400, JSON.stringify(body));
  for (const uid of ['rec', 'alu']) assert.equal(code(await batch(d1, uid, id, { studentUids: ['alu2'], dryRun: true })), 'forbidden_role', uid);
  assert.equal(code(await batch(d1, 'donoB', id, { studentUids: ['aluB'], dryRun: true })), 'no_membership');
  assert.equal(code(await api(d1, 'donoB', 'POST', `${T(B)}/${id}/assign-batch`, { body: { studentUids: ['aluB'], dryRun: true } })), 'not_found');
});

test('lote: professor só em aluno com vínculo ativo e não troca ficha de outra pessoa; ficha arquivada recusa', async () => {
  const d1 = world();
  const id = await ready(d1);
  await link(d1, 'alu', 'prof');
  await link(d1, 'alu2', 'prof2');
  const r = await batch(d1, 'prof', id, { studentUids: ['alu', 'alu2'] }, { key: key() });
  assert.equal(r.status, 200);
  const by = Object.fromEntries(data(r).results.map((x) => [x.studentUid, x]));
  assert.deepEqual([by.alu.outcome, by.alu2.reason], ['assign', 'not_your_student']);
  assert.equal(count(d1, 'training_assignments', "WHERE student_uid = 'alu2'"), 0);
  // admin atribui outra ficha ao aluno do professor: o professor não sobrescreve, mesmo com replace
  const other = await make(d1, 'dono', { name: 'Outra', exercises: EX }); await publish(d1, other);
  await api(d1, 'adm', 'POST', `${T()}/${other}/assign`, { body: { studentUid: 'alu' } });
  const r2 = data(await batch(d1, 'prof', id, { studentUids: ['alu'], replace: true, dryRun: true }));
  assert.equal(r2.results[0].reason, 'assigned_by_other');
  await api(d1, 'dono', 'POST', `${T()}/${id}/archive`, { body: {} });
  assert.equal(code(await batch(d1, 'dono', id, { studentUids: ['alu2'], dryRun: true })), 'conflict');
});

test('lote: aluno que saiu no meio da operação derruba o lote inteiro (atômico), sem atribuição parcial', async () => {
  const d1 = world();
  const id = await ready(d1);
  const real = d1.batch.bind(d1);
  d1.batch = async (stmts) => {   // simula a saída do aluno depois da prévia e antes da escrita
    d1.raw.prepare("UPDATE academy_members SET status = 'removed', removed_at = '2026-10-14T00:00:00.000Z', removed_by = 'alu2' WHERE academy_id = ? AND user_id = 'alu2'").run(A);
    return real(stmts);
  };
  const r = await batch(d1, 'dono', id, { studentUids: ['alu', 'alu2'] }, { key: key() });
  assert.equal(r.status, 409);
  assert.equal(count(d1, 'training_assignments'), 0);
  assert.equal(audit(d1, 'training.batch_assigned').length, 0);
});

test('alunos: dono e admin veem todos; professor só os seus; recepção só cadastro; aluno e outra academia não', async () => {
  const d1 = world();
  const id = await ready(d1);
  await link(d1, 'alu', 'prof');
  await api(d1, 'dono', 'POST', `${T()}/${id}/assign`, { body: { studentUid: 'alu' } });
  await api(d1, 'dono', 'POST', `${T()}/${id}/publish`, { body: {} });   // v2: o aluno fica "desatualizado"
  const S = (aid = A) => `/v1/academies/${aid}/students`;
  const all = data(await api(d1, 'dono', 'GET', S()));
  assert.deepEqual([all.total, all.students.map((s) => s.userId)], [2, ['alu', 'alu2']]);
  const alu = all.students[0];
  assert.deepEqual([alu.coach.userId, alu.training.templateId, alu.training.version, alu.training.latestVersion, alu.training.outdated], ['prof', id, 1, 2, true]);
  assert.equal(all.students[1].coach, null);
  assert.deepEqual(data(await api(d1, 'prof', 'GET', S())).students.map((s) => s.userId), ['alu']);       // só o aluno com vínculo
  assert.equal(data(await api(d1, 'prof2', 'GET', S())).total, 0);
  const rec = data(await api(d1, 'rec', 'GET', S())).students[0];
  assert.deepEqual(Object.keys(rec).sort(), ['displayName', 'joinedAt', 'status', 'userId']);               // sem professor nem ficha
  assert.equal(code(await api(d1, 'rec', 'GET', `${S()}?coach=none`)), 'forbidden_role');
  assert.equal(code(await api(d1, 'prof', 'GET', `${S()}?coach=none`)), 'forbidden_role');
  assert.equal(code(await api(d1, 'alu', 'GET', S())), 'forbidden_role');
  assert.equal(code(await api(d1, 'donoB', 'GET', S(A))), 'no_membership');
  assert.deepEqual(data(await api(d1, 'donoB', 'GET', S(B))).students.map((s) => s.userId), ['alu2B', 'aluB']);   // isolamento: só os de B
  assert.deepEqual(data(await api(d1, 'adm', 'GET', `${S()}?coach=none`)).students.map((s) => s.userId), ['alu2']);
  assert.deepEqual(data(await api(d1, 'adm', 'GET', `${S()}?training=none`)).students.map((s) => s.userId), ['alu2']);
  assert.deepEqual(data(await api(d1, 'adm', 'GET', `${S()}?training=${id}`)).students.map((s) => s.userId), ['alu']);
  assert.equal(data(await api(d1, 'adm', 'GET', `${S()}?q=%25`)).total, 0);                                 // curinga do usuário não vira padrão
  assert.equal(code(await api(d1, 'adm', 'GET', `${S()}?status=xx`)), 'invalid_request');
  assert.equal(code(await api(d1, 'adm', 'GET', `${S()}?coach=a%20b`)), 'invalid_request');
});

test('migração 0005 preserva a auditoria existente e mantém a imutabilidade', () => {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const f of MIGRATIONS.filter((m) => m < '0005')) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  db.exec("INSERT INTO academies (id, name, status, created_at, updated_at) VALUES ('academiaaaaaaaaaaaa', 'ZZ', 'active', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z')");
  db.exec("INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id) VALUES ('x1', 'academiaaaaaaaaaaaa', 'u', 'academy.created', 'academy', 'academiaaaaaaaaaaaa', '', '2026-10-14T00:00:00.000Z', 'r')");
  db.exec(readFileSync(new URL('0005_training_ops.sql', dir), 'utf8'));
  assert.equal(db.prepare('SELECT count(*) n FROM academy_audit_log').get().n, 1);
  assert.throws(() => db.exec("UPDATE academy_audit_log SET detail = 'x'"), /immutable_audit/);
  assert.throws(() => db.exec('DELETE FROM academy_audit_log'), /immutable_audit/);
  db.exec("INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id) VALUES ('x2', 'academiaaaaaaaaaaaa', 'u', 'training.batch_assigned', 'training', 't', '', '2026-10-14T00:00:00.000Z', 'r')");
  assert.throws(() => db.exec("INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id) VALUES ('x3', 'academiaaaaaaaaaaaa', 'u', 'invented.action', 'training', 't', '', '2026-10-14T00:00:00.000Z', 'r')"), /CHECK/);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'academy_audit_log'").get().n, 2);
});

test('permissão de criar fichas: dono e admin concedem ao professor; some ao trocar de papel; auditada e isolada', async () => {
  const d1 = world();
  const perm = (uid, target, value, aid = A) => api(d1, uid, 'PATCH', `/v1/academies/${aid}/members/${target}/permissions`, { body: { canCreateTrainings: value } });
  assert.equal(code(await api(d1, 'prof', 'POST', T(), { body: { name: 'Sem permissão', exercises: EX } })), 'forbidden_role');
  assert.equal((await perm('adm', 'prof', true)).status, 200);
  assert.equal((await api(d1, 'prof', 'POST', T(), { body: { name: 'Com permissão', exercises: EX } })).status, 200);
  assert.equal(data(await api(d1, 'prof', 'GET', '/v1/me')).memberships.find((m) => m.academyId === A).canCreateTrainings, true);
  assert.equal(data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/members?role=coach`)).members.find((m) => m.userId === 'prof').canCreateTrainings, true);
  assert.equal(code(await perm('adm', 'prof', true)), 'conflict');                       // mesmo valor
  for (const uid of ['prof', 'prof2', 'rec', 'alu']) assert.equal(code(await perm(uid, 'prof2', true)), 'forbidden_role', uid);
  assert.equal(code(await perm('dono', 'alu', true)), 'conflict');                       // não é professor
  assert.equal(code(await perm('dono', 'dono', true)), 'forbidden_role');
  assert.equal(code(await perm('donoB', 'prof', true, B)), 'not_found');                 // professor de A na URL de B
  assert.equal(code(await perm('donoB', 'prof', true, A)), 'no_membership');
  assert.equal((await api(d1, 'dono', 'POST', T(), { body: { name: 'x', exercises: EX, canCreateTrainings: true } })).status, 400);
  assert.equal((await api(d1, 'dono', 'PATCH', `/v1/academies/${A}/members/prof/permissions`, { body: { canCreateTrainings: 'sim' } })).status, 400);
  assert.equal((await api(d1, 'dono', 'PATCH', `/v1/academies/${A}/members/prof/role`, { body: { role: 'reception' } })).status, 200);
  assert.equal(row(d1, "SELECT can_create_trainings c FROM academy_members WHERE academy_id = ? AND user_id = 'prof'", A).c, 0);   // trocar de papel zera a permissão
  assert.equal(audit(d1, 'member.permission_changed').length, 1);
});
