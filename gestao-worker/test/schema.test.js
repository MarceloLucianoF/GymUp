// O esquema do D1 é SQLite: roda aqui no node:sqlite com o MESMO SQL da migração. Cada teste prova uma garantia que no
// Firestore eram regras (isolamento entre academias, versão imutável, último dono, ficha arquivada, um professor por aluno).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SQL = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const NOW = '2026-10-14T00:00:00.000Z';
const A = 'academiaaaaaaaaaaaa';
const B = 'academiabbbbbbbbbbbb';
const EX = JSON.stringify([{ name: 'Agachamento', sets: '3', reps: '10', rest: 60 }]);

function fresh() {
  const db = new DatabaseSync(':memory:');
  db.exec(SQL);
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  for (const [id, p] of [[A, 'a'], [B, 'b']]) {
    run('INSERT INTO academies (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, `Academia ${p}`, 'active', NOW, NOW);
    for (const [r, role] of [['owner', 'owner'], ['admin', 'admin'], ['teacher', 'teacher'], ['stu', 'student'], ['stu2', 'student']]) {
      run('INSERT INTO members (academy_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, `${p}${r}`, role, 'active', NOW, NOW);
    }
    run('INSERT INTO training_series (id, academy_id, name, status, current_version, draft_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      `s_${p}`, id, 'Perna', 'active', 1, JSON.stringify({ name: 'Perna', exercises: JSON.parse(EX) }), `${p}owner`, NOW, NOW);
    run('INSERT INTO training_versions (series_id, academy_id, version, name, exercises_json, created_by, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)', `s_${p}`, id, 'Perna', EX, `${p}owner`, NOW);
  }
  return { db, run };
}
const fails = (fn, msg) => assert.throws(fn, msg instanceof RegExp ? msg : new RegExp(msg));
const assign = (run, aid, student, series, v = 1) => run('INSERT OR REPLACE INTO assigned_trainings (academy_id, student_id, series_id, version, teacher_id, assigned_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', aid, student, series, v, '', 'x', NOW);

test('isolamento: versão de uma academia não é atribuída a aluno de outra (chave composta)', () => {
  const { run } = fresh();
  assign(run, A, 'astu', 's_a');
  fails(() => assign(run, A, 'astu2', 's_b'), /FOREIGN KEY/);      // ficha da B para aluno da A
  fails(() => assign(run, B, 'bstu', 's_a'), /FOREIGN KEY/);
  fails(() => assign(run, A, 'bstu', 's_a'), /FOREIGN KEY|not_active_student/);   // aluno da B na A
});

test('só aluno ativo recebe ficha (professor, dono e aluno suspenso não)', () => {
  const { run } = fresh();
  fails(() => assign(run, A, 'ateacher', 's_a'), 'not_active_student');
  fails(() => assign(run, A, 'aowner', 's_a'), 'not_active_student');
  run("UPDATE members SET status = 'suspended' WHERE academy_id = ? AND user_id = 'astu'", A);
  fails(() => assign(run, A, 'astu', 's_a'), 'not_active_student');
});

test('versão publicada é imutável (update, delete e série com versão não se exclui)', () => {
  const { run } = fresh();
  fails(() => run("UPDATE training_versions SET name = 'Adulterada' WHERE series_id = 's_a'"), 'immutable_version');
  fails(() => run("DELETE FROM training_versions WHERE series_id = 's_a'"), 'immutable_version');
  fails(() => run("DELETE FROM training_series WHERE id = 's_a'"), 'published_series');
  fails(() => run('INSERT INTO training_versions (series_id, academy_id, version, name, exercises_json, created_by, created_at) VALUES (?, ?, 2, ?, ?, ?, ?)', 's_a', B, 'x1', EX, 'x', NOW), /FOREIGN KEY/);
  fails(() => run('INSERT INTO training_versions (series_id, academy_id, version, name, exercises_json, created_by, created_at) VALUES (?, ?, 2, ?, ?, ?, ?)', 's_a', A, 'ok', '[]', 'x', NOW), /CHECK/);   // sem exercícios
});

test('limite de 20 exercícios e JSON válido no banco; versão sobe de 1 em 1', () => {
  const { run } = fresh();
  const many = JSON.stringify(Array.from({ length: 21 }, (_, i) => ({ name: `E${i}` })));
  fails(() => run('INSERT INTO training_versions (series_id, academy_id, version, name, exercises_json, created_by, created_at) VALUES (?, ?, 2, ?, ?, ?, ?)', 's_a', A, 'ok', many, 'x', NOW), /CHECK/);
  fails(() => run("UPDATE training_series SET current_version = 3 WHERE id = 's_a'"), 'version_step');
  run("UPDATE training_series SET current_version = 2 WHERE id = 's_a'");
  fails(() => run("UPDATE training_series SET draft_json = 'nao-json' WHERE id = 's_a'"), /CHECK/);
});

test('ficha arquivada: não recebe atribuição, não edita; quem já usa mantém; restaurar libera', () => {
  const { db, run } = fresh();
  assign(run, A, 'astu', 's_a');
  run("UPDATE training_series SET status = 'archived' WHERE id = 's_a'");
  fails(() => assign(run, A, 'astu2', 's_a'), 'archived_series');
  fails(() => run("UPDATE training_series SET name = 'Outro' WHERE id = 's_a'"), 'archived_series');
  const kept = db.prepare('SELECT version FROM assigned_trainings WHERE academy_id = ? AND student_id = ?').get(A, 'astu');
  assert.equal(kept.version, 1);
  run("UPDATE training_series SET status = 'active' WHERE id = 's_a'");
  assign(run, A, 'astu2', 's_a');
});

test('último dono é protegido (rebaixar, suspender, remover e apagar); com outro dono pode', () => {
  const { run } = fresh();
  fails(() => run("UPDATE members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aowner'", A), 'last_owner');
  fails(() => run("UPDATE members SET status = 'left' WHERE academy_id = ? AND user_id = 'aowner'", A), 'last_owner');
  fails(() => run("DELETE FROM members WHERE academy_id = ? AND user_id = 'aowner'", A), 'last_owner');
  run("UPDATE members SET role = 'owner' WHERE academy_id = ? AND user_id = 'aadmin'", A);
  run("UPDATE members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aowner'", A);
  fails(() => run("UPDATE members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aadmin'", A), 'last_owner');
  run("UPDATE members SET status = 'suspended' WHERE academy_id = ? AND user_id = 'bowner' AND 0", B);   // a academia B não é afetada
});

test('identidade do vínculo não muda (academia e usuário)', () => {
  const { run } = fresh();
  fails(() => run("UPDATE members SET user_id = 'outro' WHERE academy_id = ? AND user_id = 'astu'", A), 'immutable_identity');
  fails(() => run("UPDATE members SET academy_id = ? WHERE academy_id = ? AND user_id = 'astu'", B, A), 'immutable_identity');
});

test('um professor responsável por vez; transferir exige encerrar antes', () => {
  const { run } = fresh();
  const asg = (id, status) => run('INSERT INTO assignments (id, academy_id, student_id, teacher_id, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, A, 'astu', 'ateacher', status, 'aowner', NOW, NOW);
  asg('as1', 'pending');
  fails(() => asg('as2', 'active'), /UNIQUE/);
  run("UPDATE assignments SET status = 'ended' WHERE id = 'as1'");
  asg('as3', 'active');
  // professor de outra academia não vira responsável
  fails(() => run('INSERT INTO assignments (id, academy_id, student_id, teacher_id, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 'as4', A, 'astu2', 'bteacher', 'pending', 'aowner', NOW, NOW), /FOREIGN KEY/);
  fails(() => run('INSERT INTO assignments (id, academy_id, student_id, teacher_id, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 'as5', A, 'astu2', 'astu2', 'pending', 'aowner', NOW, NOW), /CHECK/);
});

test('aderência só com consentimento; revogar ou sair apaga na mesma operação', () => {
  const { db, run } = fresh();
  const put = () => run('INSERT OR REPLACE INTO adherence (academy_id, user_id, status, week_workouts, active_days, streak, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', A, 'astu', 'em_dia', 3, 3, 5, NOW);
  fails(put, 'no_consent');
  run("UPDATE members SET consent_adherence = 1 WHERE academy_id = ? AND user_id = 'astu'", A);
  put();
  assert.equal(db.prepare('SELECT count(*) n FROM adherence').get().n, 1);
  run("UPDATE members SET consent_adherence = 0 WHERE academy_id = ? AND user_id = 'astu'", A);
  assert.equal(db.prepare('SELECT count(*) n FROM adherence').get().n, 0);
  run("UPDATE members SET consent_adherence = 1 WHERE academy_id = ? AND user_id = 'astu'", A);
  put();
  run("UPDATE members SET status = 'left' WHERE academy_id = ? AND user_id = 'astu'", A);
  assert.equal(db.prepare('SELECT count(*) n FROM adherence').get().n, 0);
  // valores fora da faixa e campos de saúde não existem na tabela
  run("UPDATE members SET status = 'active', consent_adherence = 1 WHERE academy_id = ? AND user_id = 'astu'", A);
  fails(() => run('INSERT INTO adherence (academy_id, user_id, status, week_workouts, active_days, streak, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', A, 'astu', 'em_dia', 99, 1, 1, NOW), /CHECK/);
  const cols = db.prepare('PRAGMA table_info(adherence)').all().map((c) => c.name);
  assert.deepEqual(cols, ['academy_id', 'user_id', 'status', 'week_workouts', 'active_days', 'streak', 'updated_at']);
});

test('auditoria é imutável e só de academia existente', () => {
  const { run } = fresh();
  run('INSERT INTO audit_log (id, academy_id, actor_id, action, target_type, target_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'l1', A, 'aowner', 'academy.updated', 'academy', A, NOW);
  fails(() => run("UPDATE audit_log SET actor_id = 'forjado' WHERE id = 'l1'"), 'immutable_audit');
  fails(() => run("DELETE FROM audit_log WHERE id = 'l1'"), 'immutable_audit');
  fails(() => run('INSERT INTO audit_log (id, academy_id, actor_id, action, target_type, target_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'l2', 'inexistente000000', 'x', 'academy.updated', 'academy', 'x', NOW), /FOREIGN KEY/);
  fails(() => run('INSERT INTO audit_log (id, academy_id, actor_id, action, target_type, target_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'l3', A, 'x', 'academy.updated', 'planeta', 'x', NOW), /CHECK/);
});

test('convite: usos nunca passam do máximo; só hash do código; papel de dono não se convida', () => {
  const { run } = fresh();
  const inv = (id, hash, role, max, uses) => run('INSERT INTO invites (id, academy_id, code_hash, role, max_uses, uses, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, A, hash, role, max, uses, NOW, 'aowner', NOW);
  const h = 'a'.repeat(64);
  inv('i1', h, 'student', 2, 0);
  fails(() => inv('i2', 'b'.repeat(64), 'student', 2, 3), /CHECK/);
  fails(() => inv('i3', 'c'.repeat(64), 'owner', 2, 0), /CHECK/);
  fails(() => inv('i4', 'curto', 'student', 2, 0), /CHECK/);
  fails(() => inv('i5', h, 'student', 2, 0), /UNIQUE/);
});

test('papel e status inválidos são recusados pelo banco', () => {
  const { run } = fresh();
  fails(() => run("UPDATE members SET role = 'superuser' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);
  fails(() => run("UPDATE members SET status = 'banido' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);
  fails(() => run("UPDATE academies SET status = 'apagada' WHERE id = ?", A), /CHECK/);
});
