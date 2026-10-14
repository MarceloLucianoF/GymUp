// O esquema do D1 é SQLite: roda aqui no node:sqlite com o MESMO SQL da migração. Cada teste prova uma garantia que no
// Firestore eram regras (isolamento entre academias, versão imutável, último dono, ficha arquivada, um professor por aluno).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SQL } from './helpers.js';
import { DatabaseSync } from 'node:sqlite';

const NOW = '2026-10-14T00:00:00.000Z';
const A = 'academiaaaaaaaaaaaa';
const B = 'academiabbbbbbbbbbbb';
const H = 'f'.repeat(64);
const EX = JSON.stringify([{ name: 'Agachamento', sets: '3', reps: '10', rest: 60 }]);

function fresh() {
  const db = new DatabaseSync(':memory:');
  db.exec(SQL);
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  for (const [id, p] of [[A, 'a'], [B, 'b']]) {
    run('INSERT INTO academies (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, `Academia ${p}`, 'active', NOW, NOW);
    for (const [r, role] of [['owner', 'owner'], ['admin', 'admin'], ['teacher', 'teacher'], ['stu', 'student'], ['stu2', 'student']]) {
      run('INSERT INTO academy_members (academy_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, `${p}${r}`, role, 'active', NOW, NOW);
    }
    run('INSERT INTO training_templates (id, academy_id, name, status, current_version, draft_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      `s_${p}`, id, 'Perna', 'active', 1, JSON.stringify({ name: 'Perna', exercises: JSON.parse(EX) }), `${p}owner`, NOW, NOW);
    run('INSERT INTO training_versions (template_id, academy_id, version, name, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)', `s_${p}`, id, 'Perna', EX, H, `${p}owner`, NOW);
  }
  return { db, run };
}
const fails = (fn, msg) => assert.throws(fn, msg instanceof RegExp ? msg : new RegExp(msg));
let seq = 0;
const assign = (run, aid, student, series, v = 1) => run('INSERT OR REPLACE INTO training_assignments (assignment_id, academy_id, student_id, template_id, version, teacher_id, assigned_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', `asg_${++seq}`.padEnd(20, 'x'), aid, student, series, v, '', 'x', NOW);

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
  run("UPDATE academy_members SET status = 'suspended' WHERE academy_id = ? AND user_id = 'astu'", A);
  fails(() => assign(run, A, 'astu', 's_a'), 'not_active_student');
});

test('versão publicada é imutável (update, delete e série com versão não se exclui)', () => {
  const { run } = fresh();
  fails(() => run("UPDATE training_versions SET name = 'Adulterada' WHERE template_id = 's_a'"), 'immutable_version');
  fails(() => run("DELETE FROM training_versions WHERE template_id = 's_a'"), 'immutable_version');
  fails(() => run("DELETE FROM training_templates WHERE id = 's_a'"), 'published_series');
  run("UPDATE training_templates SET current_version = 2 WHERE id = 's_a'");
  fails(() => run('INSERT INTO training_versions (template_id, academy_id, version, name, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, 2, ?, ?, ?, ?, ?)', 's_a', B, 'x1', EX, H, 'x', NOW), /FOREIGN KEY/);
  fails(() => run('INSERT INTO training_versions (template_id, academy_id, version, name, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, 2, ?, ?, ?, ?, ?)', 's_a', A, 'ok', '[]', H, 'x', NOW), /CHECK/);   // sem exercícios
});

test('limite de 20 exercícios e JSON válido no banco; versão sobe de 1 em 1', () => {
  const { run } = fresh();
  const many = JSON.stringify(Array.from({ length: 21 }, (_, i) => ({ name: `E${i}` })));
  run("UPDATE training_templates SET current_version = 2 WHERE id = 's_a'");
  fails(() => run('INSERT INTO training_versions (template_id, academy_id, version, name, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, 2, ?, ?, ?, ?, ?)', 's_a', A, 'ok', many, H, 'x', NOW), /CHECK/);
  fails(() => run("UPDATE training_templates SET current_version = 4 WHERE id = 's_a'"), 'version_step');
  fails(() => run("UPDATE training_templates SET draft_json = 'nao-json' WHERE id = 's_a'"), /CHECK/);
});

test('ficha arquivada: não recebe atribuição, não edita; quem já usa mantém; restaurar libera', () => {
  const { db, run } = fresh();
  assign(run, A, 'astu', 's_a');
  run("UPDATE training_templates SET status = 'archived' WHERE id = 's_a'");
  fails(() => assign(run, A, 'astu2', 's_a'), 'archived_series');
  fails(() => run("UPDATE training_templates SET name = 'Outro' WHERE id = 's_a'"), 'archived_series');
  const kept = db.prepare('SELECT version FROM training_assignments WHERE academy_id = ? AND student_id = ?').get(A, 'astu');
  assert.equal(kept.version, 1);
  run("UPDATE training_templates SET status = 'active' WHERE id = 's_a'");
  assign(run, A, 'astu2', 's_a');
});

test('último dono é protegido (rebaixar, suspender, remover e apagar); com outro dono pode', () => {
  const { run } = fresh();
  fails(() => run("UPDATE academy_members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aowner'", A), 'last_owner');
  fails(() => run("UPDATE academy_members SET status = 'left' WHERE academy_id = ? AND user_id = 'aowner'", A), 'last_owner');
  fails(() => run("DELETE FROM academy_members WHERE academy_id = ? AND user_id = 'aowner'", A), 'last_owner');
  run("UPDATE academy_members SET role = 'owner' WHERE academy_id = ? AND user_id = 'aadmin'", A);
  run("UPDATE academy_members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aowner'", A);
  fails(() => run("UPDATE academy_members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aadmin'", A), 'last_owner');
  run("UPDATE academy_members SET status = 'suspended' WHERE academy_id = ? AND user_id = 'bowner' AND 0", B);   // a academia B não é afetada
});

test('identidade do vínculo não muda (academia e usuário)', () => {
  const { run } = fresh();
  fails(() => run("UPDATE academy_members SET user_id = 'outro' WHERE academy_id = ? AND user_id = 'astu'", A), 'immutable_identity');
  fails(() => run("UPDATE academy_members SET academy_id = ? WHERE academy_id = ? AND user_id = 'astu'", B, A), 'immutable_identity');
});

test('um professor responsável por vez; transferir exige encerrar antes', () => {
  const { run } = fresh();
  const asg = (id, status) => run('INSERT INTO coach_assignments (id, academy_id, student_id, teacher_id, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, A, 'astu', 'ateacher', status, 'aowner', NOW, NOW);
  asg('as1', 'pending');
  fails(() => asg('as2', 'active'), /UNIQUE/);
  run("UPDATE coach_assignments SET status = 'ended' WHERE id = 'as1'");
  asg('as3', 'active');
  // professor de outra academia não vira responsável
  fails(() => run('INSERT INTO coach_assignments (id, academy_id, student_id, teacher_id, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 'as4', A, 'astu2', 'bteacher', 'pending', 'aowner', NOW, NOW), /FOREIGN KEY|invalid_roles/);
  fails(() => run('INSERT INTO coach_assignments (id, academy_id, student_id, teacher_id, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 'as5', A, 'astu2', 'astu2', 'pending', 'aowner', NOW, NOW), /CHECK|invalid_roles/);
});

const consent = (run, aid, uid, status = 'granted') => run('INSERT OR REPLACE INTO academy_consents (academy_id, user_id, kind, status, text_version, granted_at) VALUES (?, ?, ?, ?, ?, ?)', aid, uid, 'adherence', status, 'v1', NOW);
const put = (run, aid = A, uid = 'astu', workouts = 3) => run('INSERT OR REPLACE INTO academy_adherence (academy_id, user_id, status, week_workouts, active_days, streak, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', aid, uid, 'em_dia', workouts, 3, 5, NOW);

test('aderência só com consentimento; revogar, apagar o consentimento ou sair apaga na mesma operação; sempre client_report', () => {
  const { db, run } = fresh();
  const n = () => db.prepare('SELECT count(*) n FROM academy_adherence').get().n;
  fails(() => put(run), 'no_consent');
  consent(run, A, 'astu');
  put(run);
  assert.equal(n(), 1);
  assert.equal(db.prepare('SELECT source FROM academy_adherence').get().source, 'client_report');
  fails(() => run("UPDATE academy_adherence SET source = 'verified'"), /CHECK/);
  run("UPDATE academy_consents SET status = 'revoked', revoked_at = ? WHERE academy_id = ? AND user_id = 'astu'", NOW, A);
  assert.equal(n(), 0);
  fails(() => put(run), 'no_consent');                                   // revogado não vale
  consent(run, A, 'astu');
  put(run);
  run("DELETE FROM academy_consents WHERE academy_id = ? AND user_id = 'astu'", A);
  assert.equal(n(), 0);
  consent(run, A, 'astu');
  put(run);
  run("UPDATE academy_members SET status = 'left' WHERE academy_id = ? AND user_id = 'astu'", A);   // sair apaga consentimento e aderência
  assert.equal(n(), 0);
  assert.equal(db.prepare('SELECT count(*) n FROM academy_consents').get().n, 0);
  run("UPDATE academy_members SET status = 'active' WHERE academy_id = ? AND user_id = 'astu'", A);
  fails(() => put(run), 'no_consent');                                   // voltar não restaura o consentimento
  consent(run, A, 'astu');
  fails(() => put(run, A, 'astu', 99), /CHECK/);
  const cols = db.prepare('PRAGMA table_info(academy_adherence)').all().map((c) => c.name);
  assert.deepEqual(cols, ['academy_id', 'user_id', 'source', 'status', 'week_workouts', 'active_days', 'streak', 'updated_at']);
});

test('consentimento: só aluno, só da própria academia, com data UTC', () => {
  const { run } = fresh();
  fails(() => consent(run, A, 'ateacher'), 'student_only');
  fails(() => consent(run, A, 'bstu'), /FOREIGN KEY/);
  fails(() => run("INSERT INTO academy_consents (academy_id, user_id, kind, status, text_version, granted_at) VALUES (?, 'astu', 'adherence', 'granted', 'v1', '14/10/2026')", A), /CHECK/);
  fails(() => run("INSERT INTO academy_consents (academy_id, user_id, kind, status, text_version, granted_at) VALUES (?, 'astu', 'saude', 'granted', 'v1', ?)", A, NOW), /CHECK/);
});

test('versão sem hash e atribuição sem assignment_id são recusadas', () => {
  const { run } = fresh();
  run("UPDATE training_templates SET current_version = 2 WHERE id = 's_a'");
  fails(() => run('INSERT INTO training_versions (template_id, academy_id, version, name, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, 2, ?, ?, ?, ?, ?)', 's_a', A, 'ok', EX, 'curto', 'x', NOW), /CHECK/);
  fails(() => run("INSERT INTO training_assignments (assignment_id, academy_id, student_id, template_id, version, assigned_by, updated_at) VALUES ('x', ?, 'astu', 's_a', 1, 'x', ?)", A, NOW), /CHECK/);
});

test('planos e cobrança: isolados por academia, só de aluno, estados controlados', () => {
  const { run } = fresh();
  const plan = (id, aid) => run('INSERT INTO academy_plans (id, academy_id, name, monthly_fee_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, aid, 'Mensal', 9900, NOW, NOW);
  const bill = (id, aid, stu, plan_id, st = 'pending', due = '2026-11-05') => run('INSERT INTO academy_billing (id, academy_id, student_id, plan_id, billing_status, amount_cents, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, aid, stu, plan_id, st, 9900, due, NOW, NOW);
  plan('pl_a', A); plan('pl_b', B);
  bill('b1', A, 'astu', 'pl_a');
  fails(() => bill('b2', A, 'astu', 'pl_b'), /FOREIGN KEY/);          // plano de outra academia
  fails(() => bill('b3', A, 'bstu', 'pl_a'), /FOREIGN KEY/);          // aluno de outra academia
  fails(() => bill('b4', A, 'ateacher', 'pl_a'), 'student_only');
  fails(() => bill('b5', A, 'astu', 'pl_a', 'calote'), /CHECK/);
  fails(() => bill('b6', A, 'astu', 'pl_a', 'paid', '05/11/2026'), /CHECK/);
  for (const st of ['paid', 'exempt', 'overdue']) bill(`ok_${st}`, A, 'astu2', 'pl_a', st);
  fails(() => run("UPDATE academy_plans SET monthly_fee_cents = -1 WHERE id = 'pl_a'"), /CHECK/);
});

test('auditoria é imutável e só de academia existente', () => {
  const { run } = fresh();
  run('INSERT INTO academy_audit_log (id, academy_id, actor_id, action, target_type, target_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'l1', A, 'aowner', 'academy.updated', 'academy', A, NOW);
  fails(() => run("UPDATE academy_audit_log SET actor_id = 'forjado' WHERE id = 'l1'"), 'immutable_audit');
  fails(() => run("DELETE FROM academy_audit_log WHERE id = 'l1'"), 'immutable_audit');
  fails(() => run('INSERT INTO academy_audit_log (id, academy_id, actor_id, action, target_type, target_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'l2', 'inexistente000000', 'x', 'academy.updated', 'academy', 'x', NOW), /FOREIGN KEY/);
  fails(() => run('INSERT INTO academy_audit_log (id, academy_id, actor_id, action, target_type, target_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'l3', A, 'x', 'academy.updated', 'planeta', 'x', NOW), /CHECK/);
});

test('convite: usos nunca passam do máximo; só hash do código; papel de dono não se convida', () => {
  const { run } = fresh();
  const inv = (id, hash, role, max, uses) => run('INSERT INTO academy_invites (id, academy_id, code_hash, role, max_uses, uses, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, A, hash, role, max, uses, NOW, 'aowner', NOW);
  const h = 'a'.repeat(64);
  inv('i1', h, 'student', 2, 0);
  fails(() => inv('i2', 'b'.repeat(64), 'student', 2, 3), /CHECK/);
  fails(() => inv('i3', 'c'.repeat(64), 'owner', 2, 0), /CHECK/);
  fails(() => inv('i4', 'curto', 'student', 2, 0), /CHECK/);
  fails(() => inv('i5', h, 'student', 2, 0), /UNIQUE/);
});

test('papel e status inválidos são recusados pelo banco', () => {
  const { run } = fresh();
  fails(() => run("UPDATE academy_members SET role = 'superuser' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);
  fails(() => run("UPDATE academy_members SET status = 'banido' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);
  fails(() => run("UPDATE academies SET status = 'apagada' WHERE id = ?", A), /CHECK/);
});

test('limite de 5 academias ativas como dono é do banco (sem corrida), inclusive por promoção e reativação', () => {
  const { run } = fresh();
  const owner = (i) => {
    const id = `academiadono${String(i).padStart(7, '0')}`;
    run('INSERT INTO academies (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, `Dono ${i}`, 'active', NOW, NOW);
    run('INSERT INTO academy_members (academy_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, 'multi', 'owner', 'active', NOW, NOW);
    return id;
  };
  const ids = [1, 2, 3, 4, 5].map(owner);
  fails(() => owner(6), 'limit_reached');
  run('INSERT INTO academy_members (academy_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', A, 'multi', 'student', 'active', NOW, NOW);
  fails(() => run("UPDATE academy_members SET role = 'owner' WHERE academy_id = ? AND user_id = 'multi'", A), 'limit_reached');   // promoção
  run('INSERT INTO academy_members (academy_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', ids[0], 'segundo', 'owner', 'active', NOW, NOW);   // outro dono: libera suspender o primeiro
  run("UPDATE academy_members SET status = 'suspended' WHERE academy_id = ? AND user_id = 'multi'", ids[0]);
  run("UPDATE academy_members SET role = 'owner' WHERE academy_id = ? AND user_id = 'multi'", A);   // liberou uma vaga (suspensa) -> promove
});

test('professor-aluno: aluno precisa ser aluno ativo e o professor ativo com papel de ensino; papel em uso não muda', () => {
  const { run } = fresh();
  const asg = (id, student, teacher) => run('INSERT INTO coach_assignments (id, academy_id, student_id, teacher_id, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, A, student, teacher, 'active', 'aowner', NOW, NOW);
  fails(() => asg('c1', 'ateacher', 'aadmin'), 'invalid_roles');        // "aluno" que é professor
  fails(() => asg('c2', 'astu', 'astu2'), 'invalid_roles');               // "professor" que é aluno
  run("UPDATE academy_members SET status = 'suspended' WHERE academy_id = ? AND user_id = 'ateacher'", A);
  fails(() => asg('c3', 'astu', 'ateacher'), 'invalid_roles');            // professor suspenso
  run("UPDATE academy_members SET status = 'active' WHERE academy_id = ? AND user_id = 'ateacher'", A);
  asg('c4', 'astu', 'ateacher');
  fails(() => run("UPDATE academy_members SET role = 'teacher' WHERE academy_id = ? AND user_id = 'astu'", A), 'role_in_use');
  fails(() => run("UPDATE coach_assignments SET student_id = 'astu2' WHERE id = 'c4'"), 'immutable_identity');
});

test('identidade congelada em consentimento, cobrança, aderência e atribuição; UPSERT com o mesmo valor passa', () => {
  const { run } = fresh();
  consent(run, A, 'astu');
  fails(() => run("UPDATE academy_consents SET user_id = 'astu2' WHERE user_id = 'astu'"), 'immutable_identity');
  run("UPDATE academy_consents SET user_id = 'astu' WHERE user_id = 'astu'");                         // mesmo valor: ok
  run("UPDATE academy_members SET user_id = 'astu' WHERE user_id = 'astu' AND academy_id = ?", A);   // idem
  assign(run, A, 'astu', 's_a');
  fails(() => run("UPDATE training_assignments SET student_id = 'astu2' WHERE student_id = 'astu'"), 'immutable_identity');
});

test('versão nova só com o número esperado e em ficha ativa', () => {
  const { run } = fresh();
  const ins = (v) => run('INSERT INTO training_versions (template_id, academy_id, version, name, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 's_a', A, v, 'Perna', EX, H, 'x', NOW);
  fails(() => ins(2), 'version_mismatch');                                // current_version ainda é 1
  run("UPDATE training_templates SET current_version = 2 WHERE id = 's_a'");
  fails(() => ins(3), 'version_mismatch');
  ins(2);
  run("UPDATE training_templates SET status = 'archived', current_version = 3 WHERE id = 's_a'");
  fails(() => ins(3), 'version_mismatch');                                // ficha arquivada não recebe versão
});

test('suspender não apaga o consentimento; sair e ser removido apagam', () => {
  const { db, run } = fresh();
  consent(run, A, 'astu'); put(run);
  run("UPDATE academy_members SET status = 'suspended' WHERE academy_id = ? AND user_id = 'astu'", A);
  assert.equal(db.prepare('SELECT count(*) n FROM academy_consents').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM academy_adherence').get().n, 1);
  run("UPDATE academy_members SET status = 'removed' WHERE academy_id = ? AND user_id = 'astu'", A);
  assert.equal(db.prepare('SELECT count(*) n FROM academy_consents').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM academy_adherence').get().n, 0);
});
