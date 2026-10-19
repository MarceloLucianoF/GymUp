// O esquema do D1 é SQLite: roda aqui no node:sqlite com as MESMAS migrações. Cada teste prova uma garantia que no Firestore eram regras
// (isolamento entre academias, versão imutável, último dono, ficha arquivada, um professor ativo por aluno, consentimento).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, NOW, SQL, makeD1, seedAcademy, seedMember } from './helpers.js';

const A = 'academiaaaaaaaaaaaa';
const B = 'academiabbbbbbbbbbbb';
const H = 'f'.repeat(64);
const EX = JSON.stringify([{ name: 'Agachamento', sets: '3', reps: '10', rest: 60 }]);

function fresh() {
  const d1 = makeD1();
  const run = (sql, ...p) => d1.raw.prepare(sql).run(...p);
  for (const [id, p] of [[A, 'a'], [B, 'b']]) {
    seedAcademy(d1, id, `Academia ${p}`);
    for (const [r, role] of [['owner', 'owner'], ['admin', 'admin'], ['coach', 'coach'], ['coach2', 'coach'], ['stu', 'student'], ['stu2', 'student'], ['rec', 'reception']]) seedMember(d1, id, `${p}${r}`, role);
    run('INSERT INTO training_templates (id, academy_id, name, status, current_version, draft_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      `s_${p}`, id, 'Perna', 'active', 1, JSON.stringify({ exercises: JSON.parse(EX) }), `${p}owner`, NOW, NOW);
    run('INSERT INTO training_versions (template_id, academy_id, version, name, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)', `s_${p}`, id, 'Perna', EX, H, `${p}owner`, NOW);
  }
  return { d1, db: d1.raw, run };
}
const fails = (fn, msg) => assert.throws(fn, msg instanceof RegExp ? msg : new RegExp(msg));
let seq = 0;
const assign = (run, aid, student, tpl, v = 1) => run('INSERT OR REPLACE INTO training_assignments (assignment_id, academy_id, student_uid, template_id, version, assigned_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', `asg_${++seq}`.padEnd(20, 'x'), aid, student, tpl, v, 'x', NOW);
const coach = (run, id, aid, student, coachUid, status = 'pending_student') => run(
  `INSERT INTO coach_assignments (id, academy_id, student_uid, coach_uid, status, proposed_by, accepted_at, revoked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  id, aid, student, coachUid, status, 'x', status === 'active' ? NOW : null, ['revoked', 'rejected'].includes(status) ? NOW : null, NOW, NOW);
const consent = (run, aid, uid, status = 'granted') => run(
  'INSERT OR REPLACE INTO academy_consents (academy_id, student_uid, share_adherence, status, granted_at, revoked_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  aid, uid, status === 'granted' ? 1 : 0, status, NOW, status === 'revoked' ? NOW : null, NOW);

test('migrações: aplicam em ordem, são idempotentes por arquivo e criam todas as tabelas do domínio', () => {
  assert.deepEqual(MIGRATIONS, ['0001_core.sql', '0002_coaching.sql', '0003_training.sql', '0004_business.sql', '0005_training_ops.sql', '0006_export_close.sql', '0007_finance.sql']);
  const db = new DatabaseSync(':memory:');
  db.exec(SQL);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(tables, ['academies', 'academy_audit_log', 'academy_billing', 'academy_consents', 'academy_invites', 'academy_members', 'academy_plans', 'coach_assignments', 'idempotency_keys', 'student_contracts', 'training_assignments', 'training_templates', 'training_versions']);
  assert.throws(() => db.exec(SQL), /already exists/);   // reaplicar a mesma migração falha: o controle de versão do D1 evita duplicar
});

test('toda tabela empresarial tem academy_id; nenhuma guarda peso, medidas, cargas ou e-mail', () => {
  const { db } = fresh();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
    assert.ok(t === 'academies' ? cols.includes('id') : cols.includes('academy_id'), `${t} sem academy_id`);   // academies é a própria raiz: o id é o academy_id
    for (const banned of ['weight', 'peso', 'height', 'altura', 'measure', 'medida', 'load', 'carga', 'volume', 'email', 'phone', 'cpf', 'health']) {
      assert.ok(!cols.some((c) => c.toLowerCase().includes(banned) && c !== 'contact_email'), `${t}.${banned}`);
    }
  }
});

test('índices pedidos existem (academy_id, status, role, updated_at, únicos de convite, membro e professor)', () => {
  const { db } = fresh();
  const idx = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").all();
  const names = idx.map((i) => i.name);
  for (const n of ['members_role', 'members_status', 'invites_academy_active', 'invites_academy_updated', 'audit_academy_created', 'coach_one_open', 'coach_one_active', 'coach_by_coach', 'consents_status', 'billing_academy_due', 'templates_academy']) assert.ok(names.includes(n), n);
  assert.ok(idx.find((i) => i.name === 'coach_one_active').sql.includes('UNIQUE'));
  // as consultas quentes usam índice (não varrem a tabela)
  const plan = (sql, ...p) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...p).map((r) => r.detail).join(' ');
  assert.match(plan('SELECT * FROM academy_members WHERE academy_id = ? AND role = ? AND status = ?', A, 'coach', 'active'), /USING (COVERING )?INDEX/);
  assert.match(plan('SELECT * FROM academy_audit_log WHERE academy_id = ? ORDER BY created_at DESC LIMIT 10', A), /USING (COVERING )?INDEX/);
  assert.match(plan('SELECT * FROM academy_invites WHERE academy_id = ? AND revoked = 0 AND expires_at > ?', A, NOW), /USING (COVERING )?INDEX/);
});

test('chaves estrangeiras ligadas: nada aponta para academia ou membro inexistente; unicidade de membro', () => {
  const { db, run } = fresh();
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  fails(() => run("INSERT INTO academy_members (academy_id, user_id, role, status, created_at, updated_at) VALUES ('inexistente0000000', 'x', 'student', 'active', ?, ?)", NOW, NOW), /FOREIGN KEY/);
  fails(() => seedMember({ raw: db }, A, 'astu', 'student'), /UNIQUE|PRIMARY/);
});

test('isolamento: versão de uma academia não é atribuída a aluno de outra (chave composta)', () => {
  const { run } = fresh();
  assign(run, A, 'astu', 's_a');
  fails(() => assign(run, A, 'astu2', 's_b'), /FOREIGN KEY/);
  fails(() => assign(run, B, 'bstu', 's_a'), /FOREIGN KEY/);
  fails(() => assign(run, A, 'bstu', 's_a'), /FOREIGN KEY|not_active_student/);
});

test('só aluno ativo recebe ficha', () => {
  const { run } = fresh();
  fails(() => assign(run, A, 'acoach', 's_a'), 'not_active_student');
  fails(() => assign(run, A, 'aowner', 's_a'), 'not_active_student');
  run("UPDATE academy_members SET status = 'suspended', suspended_at = ? WHERE academy_id = ? AND user_id = 'astu'", NOW, A);
  fails(() => assign(run, A, 'astu', 's_a'), 'not_active_student');
});

test('versão publicada é imutável; ficha publicada não se exclui; versão nova só com o número esperado e em ficha ativa', () => {
  const { run } = fresh();
  const ins = (v, ex = EX, hash = H, aid = A) => run('INSERT INTO training_versions (template_id, academy_id, version, name, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 's_a', aid, v, 'Perna', ex, hash, 'x', NOW);
  fails(() => run("UPDATE training_versions SET name = 'Adulterada' WHERE template_id = 's_a'"), 'immutable_version');
  fails(() => run("DELETE FROM training_versions WHERE template_id = 's_a'"), 'immutable_version');
  fails(() => run("DELETE FROM training_templates WHERE id = 's_a'"), 'published_template');
  fails(() => ins(2), 'version_mismatch');
  fails(() => run("UPDATE training_templates SET current_version = 3 WHERE id = 's_a'"), 'version_step');
  run("UPDATE training_templates SET current_version = 2 WHERE id = 's_a'");
  fails(() => ins(2, EX, H, B), /FOREIGN KEY/);
  fails(() => ins(2, '[]'), /CHECK/);
  fails(() => ins(2, JSON.stringify(Array.from({ length: 21 }, (_, i) => ({ name: `E${i}` })))), /CHECK/);
  fails(() => ins(2, EX, 'curto'), /CHECK/);
  ins(2);
  run("UPDATE training_templates SET status = 'archived', current_version = 3 WHERE id = 's_a'");
  fails(() => ins(3), 'version_mismatch');
});

test('ficha arquivada: não recebe atribuição nem edição; quem já usa mantém; restaurar libera', () => {
  const { db, run } = fresh();
  assign(run, A, 'astu', 's_a');
  run("UPDATE training_templates SET status = 'archived' WHERE id = 's_a'");
  fails(() => assign(run, A, 'astu2', 's_a'), 'archived_template');
  fails(() => run("UPDATE training_templates SET name = 'Outro' WHERE id = 's_a'"), 'archived_template');
  assert.equal(db.prepare('SELECT version FROM training_assignments WHERE academy_id = ? AND student_uid = ?').get(A, 'astu').version, 1);
  run("UPDATE training_templates SET status = 'active' WHERE id = 's_a'");
  assign(run, A, 'astu2', 's_a');
});

test('último dono é protegido; com outro dono pode; identidade congelada, mas UPSERT com o mesmo valor passa', () => {
  const { run } = fresh();
  fails(() => run("UPDATE academy_members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aowner'", A), 'last_owner');
  fails(() => run("UPDATE academy_members SET status = 'suspended', suspended_at = ? WHERE academy_id = ? AND user_id = 'aowner'", NOW, A), 'last_owner');
  fails(() => run("DELETE FROM academy_members WHERE academy_id = ? AND user_id = 'aowner'", A), 'last_owner');
  run("UPDATE academy_members SET role = 'owner' WHERE academy_id = ? AND user_id = 'aadmin'", A);
  run("UPDATE academy_members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aowner'", A);
  fails(() => run("UPDATE academy_members SET role = 'admin' WHERE academy_id = ? AND user_id = 'aadmin'", A), 'last_owner');
  fails(() => run("UPDATE academy_members SET user_id = 'outro' WHERE academy_id = ? AND user_id = 'astu'", A), 'immutable_identity');
  fails(() => run("UPDATE academy_members SET academy_id = ? WHERE academy_id = ? AND user_id = 'astu'", B, A), 'immutable_identity');
  run("UPDATE academy_members SET user_id = 'astu' WHERE academy_id = ? AND user_id = 'astu'", A);
});

test('estados e papéis: só os válidos; removido exige removed_at e removed_by; suspenso exige suspended_at', () => {
  const { run } = fresh();
  fails(() => run("UPDATE academy_members SET role = 'teacher' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);   // 'teacher' foi renomeado para 'coach'
  fails(() => run("UPDATE academy_members SET role = 'superuser' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);
  fails(() => run("UPDATE academy_members SET status = 'left' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);
  fails(() => run("UPDATE academy_members SET status = 'removed' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);
  fails(() => run("UPDATE academy_members SET status = 'suspended' WHERE academy_id = ? AND user_id = 'astu'", A), /CHECK/);
  run("UPDATE academy_members SET status = 'pending' WHERE academy_id = ? AND user_id = 'astu'", A);
  run("UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = 'astu' WHERE academy_id = ? AND user_id = 'astu'", NOW, A);
  fails(() => run("UPDATE academies SET status = 'apagada' WHERE id = ?", A), /CHECK/);
});

test('limite de 5 academias ativas como dono é do banco (insert, promoção)', () => {
  const { run } = fresh();
  const owner = (i) => {
    const id = `academiadono${String(i).padStart(7, '0')}`;
    run('INSERT INTO academies (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, `Dono ${i}`, 'active', NOW, NOW);
    run('INSERT INTO academy_members (academy_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, 'multi', 'owner', 'active', NOW, NOW);
    return id;
  };
  [1, 2, 3, 4, 5].forEach(owner);
  fails(() => owner(6), 'limit_reached');
  run('INSERT INTO academy_members (academy_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', A, 'multi', 'student', 'active', NOW, NOW);
  fails(() => run("UPDATE academy_members SET role = 'owner' WHERE academy_id = ? AND user_id = 'multi'", A), 'limit_reached');
});

// ---------- professor-aluno ----------
test('professor-aluno: aluno ativo e coach ativo da mesma academia; um aberto e um ativo por aluno', () => {
  const { run } = fresh();
  fails(() => coach(run, 'c1', A, 'acoach', 'acoach2'), 'invalid_roles');            // "aluno" que é coach
  fails(() => coach(run, 'c2', A, 'astu', 'astu2'), 'invalid_roles');                // "coach" que é aluno
  fails(() => coach(run, 'c3', A, 'astu', 'aadmin'), 'invalid_roles');               // admin não é coach
  fails(() => coach(run, 'c4', A, 'astu', 'bcoach'), /FOREIGN KEY|invalid_roles/);   // coach de outra academia
  fails(() => coach(run, 'c5', A, 'bstu', 'acoach'), /FOREIGN KEY|invalid_roles/);
  run("UPDATE academy_members SET status = 'suspended', suspended_at = ? WHERE academy_id = ? AND user_id = 'acoach2'", NOW, A);
  fails(() => coach(run, 'c6', A, 'astu', 'acoach2'), 'invalid_roles');             // coach suspenso
  coach(run, 'c7', A, 'astu', 'acoach');
  fails(() => coach(run, 'c8', A, 'astu', 'acoach', 'proposed'), /UNIQUE/);          // segunda proposta em aberto
  run("UPDATE coach_assignments SET status = 'active', accepted_at = ?, updated_at = ? WHERE id = 'c7'", NOW, NOW);
  coach(run, 'c9', A, 'astu', 'acoach', 'proposed');                                // proposta nova com um ativo é permitida (transferência)
  run("UPDATE coach_assignments SET status = 'pending_student', updated_at = ? WHERE id = 'c9'", NOW);
  fails(() => run("UPDATE coach_assignments SET status = 'active', accepted_at = ? WHERE id = 'c9'", NOW), /UNIQUE/);   // dois ativos: o Worker revoga o anterior antes
  run("UPDATE coach_assignments SET status = 'revoked', revoked_at = ? WHERE id = 'c7'", NOW);
  run("UPDATE coach_assignments SET status = 'active', accepted_at = ? WHERE id = 'c9'", NOW);
  fails(() => run("UPDATE coach_assignments SET student_uid = 'astu2' WHERE id = 'c9'"), 'immutable_identity');
});

test('professor-aluno: transições válidas; rejeitado e encerrado são finais; ativar exige os dois ativos', () => {
  const { run } = fresh();
  const set = (id, st) => run(`UPDATE coach_assignments SET status = ?, accepted_at = CASE WHEN ? = 'active' THEN ? ELSE accepted_at END, revoked_at = CASE WHEN ? IN ('revoked','rejected') THEN ? ELSE revoked_at END WHERE id = ?`, st, st, NOW, st, NOW, id);
  coach(run, 'c1', A, 'astu', 'acoach', 'proposed');
  fails(() => set('c1', 'active'), 'invalid_transition');                            // não pula a aprovação e o aceite do aluno
  set('c1', 'pending_student');
  run("UPDATE academy_members SET status = 'suspended', suspended_at = ? WHERE academy_id = ? AND user_id = 'acoach'", NOW, A);
  fails(() => set('c1', 'active'), 'invalid_roles');                                 // coach suspenso entre a proposta e o aceite
  run("UPDATE academy_members SET status = 'active' WHERE academy_id = ? AND user_id = 'acoach'", A);
  set('c1', 'active');
  fails(() => set('c1', 'pending_student'), 'invalid_transition');
  set('c1', 'revoked');
  fails(() => set('c1', 'active'), 'invalid_transition');
  coach(run, 'c2', A, 'astu2', 'acoach', 'pending_student');
  set('c2', 'rejected');
  fails(() => set('c2', 'pending_student'), 'invalid_transition');
});

test('professor-aluno: remover ou rebaixar o coach e remover o aluno revogam os vínculos em aberto', () => {
  const { db, run } = fresh();
  const st = (id) => db.prepare('SELECT status FROM coach_assignments WHERE id = ?').get(id).status;
  coach(run, 'c1', A, 'astu', 'acoach', 'active');
  coach(run, 'c2', A, 'astu2', 'acoach', 'pending_student');
  run("UPDATE academy_members SET role = 'reception' WHERE academy_id = ? AND user_id = 'acoach'", A);   // deixa de ser coach
  assert.deepEqual([st('c1'), st('c2')], ['revoked', 'revoked']);
  coach(run, 'c3', A, 'astu', 'acoach2', 'active');
  run("UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = 'astu' WHERE academy_id = ? AND user_id = 'astu'", NOW, A);   // aluno sai
  assert.equal(st('c3'), 'revoked');
  coach(run, 'c4', A, 'astu2', 'acoach2', 'active');
  run("UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = 'aowner' WHERE academy_id = ? AND user_id = 'acoach2'", NOW, A);   // coach removido
  assert.equal(st('c4'), 'revoked');
});

// ---------- consentimento ----------
test('consentimento: só aluno da própria academia; estados coerentes; revogar ao sair; suspender não revoga', () => {
  const { db, run } = fresh();
  fails(() => consent(run, A, 'acoach'), 'student_only');
  fails(() => consent(run, A, 'bstu'), /FOREIGN KEY|student_only/);
  fails(() => run("INSERT INTO academy_consents (academy_id, student_uid, share_adherence, status, granted_at, updated_at) VALUES (?, 'astu', 0, 'granted', ?, ?)", A, NOW, NOW), /CHECK/);   // concedido com share 0
  fails(() => run("INSERT INTO academy_consents (academy_id, student_uid, share_adherence, status, granted_at, updated_at) VALUES (?, 'astu', 1, 'revoked', ?, ?)", A, NOW, NOW), /CHECK/);   // revogado sem data
  fails(() => run("INSERT INTO academy_consents (academy_id, student_uid, share_adherence, status, granted_at, updated_at) VALUES (?, 'astu', 1, 'granted', '14/10/2026', ?)", A, NOW), /CHECK/);
  consent(run, A, 'astu');
  run("UPDATE academy_members SET status = 'suspended', suspended_at = ? WHERE academy_id = ? AND user_id = 'astu'", NOW, A);
  assert.equal(db.prepare("SELECT status FROM academy_consents WHERE student_uid = 'astu'").get().status, 'granted');
  run("UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = 'astu' WHERE academy_id = ? AND user_id = 'astu'", NOW, A);
  const c = db.prepare("SELECT * FROM academy_consents WHERE student_uid = 'astu'").get();
  assert.deepEqual([c.status, c.share_adherence], ['revoked', 0]);
  assert.ok(c.revoked_at);
});

test('aluno com registros não muda de papel (ficha, consentimento, cobrança ou professor em aberto)', () => {
  const { run } = fresh();
  consent(run, A, 'astu');
  fails(() => run("UPDATE academy_members SET role = 'coach' WHERE academy_id = ? AND user_id = 'astu'", A), 'role_in_use');
  coach(run, 'c1', A, 'astu2', 'acoach');
  fails(() => run("UPDATE academy_members SET role = 'coach' WHERE academy_id = ? AND user_id = 'astu2'", A), 'role_in_use');
});

// ---------- convites e auditoria ----------
test('convite: usos não passam do máximo, só hash do código, papel de dono não se convida, datas em UTC', () => {
  const { run } = fresh();
  const inv = (id, hash, role, max, uses, exp = NOW) => run('INSERT INTO academy_invites (id, academy_id, code_hash, role, max_uses, uses, expires_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', id, A, hash, role, max, uses, exp, 'aowner', NOW, NOW);
  inv('i1', 'a'.repeat(64), 'student', 2, 0);
  fails(() => inv('i2', 'b'.repeat(64), 'student', 2, 3), /CHECK/);
  fails(() => inv('i3', 'c'.repeat(64), 'owner', 2, 0), /CHECK/);
  fails(() => inv('i4', 'curto', 'student', 2, 0), /CHECK/);
  fails(() => inv('i5', 'a'.repeat(64), 'student', 2, 0), /UNIQUE/);
  fails(() => inv('i6', 'd'.repeat(64), 'student', 2, 0, '14/10/2026'), /CHECK/);
});

test('auditoria: imutável, só ações conhecidas, só de academia existente, datas em UTC', () => {
  const { run } = fresh();
  const log = (id, aid, action, tt = 'academy', at = NOW) => run('INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, created_at, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, aid, 'aowner', action, tt, 'x', at, 'req-1');
  log('l1', A, 'academy.updated');
  fails(() => run("UPDATE academy_audit_log SET actor_uid = 'forjado' WHERE id = 'l1'"), 'immutable_audit');
  fails(() => run("DELETE FROM academy_audit_log WHERE id = 'l1'"), 'immutable_audit');
  fails(() => log('l2', 'inexistente000000', 'academy.updated'), /FOREIGN KEY/);
  fails(() => log('l3', A, 'academy.hackeada'), /CHECK/);
  fails(() => log('l4', A, 'academy.updated', 'planeta'), /CHECK/);
  fails(() => log('l5', A, 'academy.updated', 'academy', 'ontem'), /CHECK/);
});

test('planos, contratos e cobranças: isolados por academia, só de aluno ativo, estados e valores controlados', () => {
  const { run } = fresh();
  const plan = (id, aid) => run('INSERT INTO academy_plans (id, academy_id, name, monthly_fee_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, aid, 'Mensal', 9900, NOW, NOW);
  const contract = (id, aid, stu, planId, extra = {}) => run('INSERT INTO student_contracts (id, academy_id, student_uid, plan_id, fee_cents, due_day, start_date, status, end_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', id, aid, stu, planId, 9900, extra.day ?? 5, '2026-10-01', extra.status ?? 'active', extra.end ?? null, 'dono', NOW, NOW);
  const bill = (id, aid, stu, planId, st = 'pending', due = '2026-11-05', month = '2026-11', contractId = 'c1', extra = '') => run(`INSERT INTO academy_billing (id, academy_id, student_uid, contract_id, plan_id, reference_month, amount_cents, due_date, billing_status, ${st === 'paid' ? 'paid_at, paid_amount_cents, payment_method, registered_by, ' : ''}created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${st === 'paid' ? "'2026-11-04', 9900, 'pix', 'dono', " : ''}?, ?)`, id, aid, stu, contractId, planId, month, 9900, due, st, NOW, NOW);
  plan('pl_a', A); plan('pl_b', B);
  fails(() => contract('c0', A, 'acoach', 'pl_a'), 'not_active_student');
  fails(() => contract('c0', A, 'astu', 'pl_b'), /FOREIGN KEY/);
  fails(() => contract('c0', A, 'astu', 'pl_a', { day: 29 }), /CHECK/);
  contract('c1', A, 'astu', 'pl_a');
  fails(() => contract('c2', A, 'astu', 'pl_a'), /UNIQUE/);                                   // um contrato aberto por aluno
  fails(() => contract('c2', A, 'astu2', 'pl_a', { status: 'ended' }), /CHECK/);              // encerrado exige data
  bill('b1', A, 'astu', 'pl_a');
  fails(() => bill('b2', A, 'astu', 'pl_a', 'pending', '2026-11-05', '2026-11'), /UNIQUE/);   // uma cobrança por contrato e mês
  fails(() => bill('b3', A, 'astu', 'pl_b', 'pending', '2026-11-05', '2026-12'), /FOREIGN KEY/);
  fails(() => bill('b4', A, 'astu2', 'pl_a', 'pending', '2026-11-05', '2026-12'), /FOREIGN KEY/);   // contrato de outro aluno
  fails(() => bill('b5', A, 'astu', 'pl_a', 'calote', '2026-11-05', '2026-12'), /CHECK/);
  fails(() => bill('b6', A, 'astu', 'pl_a', 'pending', '05/11/2026', '2026-12'), /CHECK/);
  fails(() => run("UPDATE academy_billing SET billing_status = 'paid' WHERE id = 'b1'"), /CHECK/);   // pago exige data, valor, forma e quem registrou
  fails(() => run('UPDATE academy_billing SET discount_cents = 99999 WHERE id = \'b1\''), /CHECK/);
  bill('ok_paid', A, 'astu', 'pl_a', 'paid', '2026-11-05', '2026-12');
  fails(() => run("UPDATE academy_billing SET student_uid = 'astu2' WHERE id = 'b1'"), 'immutable_identity');
  run("UPDATE academy_billing SET billing_status = 'canceled' WHERE id = 'b1'");
  fails(() => run("UPDATE academy_billing SET billing_status = 'pending' WHERE id = 'b1'"), 'billing_final');
  run("UPDATE student_contracts SET status = 'ended', end_date = '2026-11-30' WHERE id = 'c1'");
  fails(() => run("UPDATE student_contracts SET status = 'active' WHERE id = 'c1'"), 'contract_ended');
});

test('rollback: se uma instrução do batch falha, nada do batch fica gravado', async () => {
  const { d1, db } = fresh();
  const before = db.prepare('SELECT count(*) n FROM academies').get().n;
  await assert.rejects(d1.batch([
    d1.prepare('INSERT INTO academies (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind('academiaroll00000001', 'Vai voltar', 'active', NOW, NOW),
    d1.prepare('INSERT INTO academy_members (academy_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind('academiaroll00000001', 'u', 'owner', 'active', NOW, NOW),
    d1.prepare("INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, created_at) VALUES ('a1', 'academiaroll00000001', 'u', 'acao.invalida', 'academy', 'x', ?)").bind(NOW)
  ]), /CHECK/);
  assert.equal(db.prepare('SELECT count(*) n FROM academies').get().n, before);
  assert.equal(db.prepare("SELECT count(*) n FROM academy_members WHERE academy_id = 'academiaroll00000001'").get().n, 0);
});
