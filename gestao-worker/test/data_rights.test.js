import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { A, B, accept, api, assert, audit, code, count, data, key, makeInvite, resetRateLimit, row, rows, world } from './kit.js';
import { MIGRATIONS } from './helpers.js';

test.beforeEach(() => resetRateLimit());
const EX = [{ name: 'Leg Press', sets: '3', reps: '10', rest: 60 }];
const NAME = 'ZZ TESTE Gestão A';
const link = async (d1, student, coach) => {
  const id = data(await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: student, coachUid: coach }, key: key() })).assignmentId;
  await api(d1, student, 'POST', `/v1/coach-assignments/${id}/accept`, { body: {} });
};
const populate = async (d1) => {
  const t = data(await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings`, { body: { name: 'Perna', exercises: EX } })).templateId;
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings/${t}/publish`, { body: {} });
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings/${t}/assign`, { body: { studentUid: 'alu' } });
  await link(d1, 'alu', 'prof');
  await api(d1, 'alu', 'PUT', `/v1/me/academies/${A}/consent`, { body: { shareAdherence: true } });
  return t;
};

test('exportar: só o dono; traz membros, fichas, versões, atribuições, consentimentos e auditoria; sem código de convite nem e-mail; fica auditado', async () => {
  const d1 = world();
  await populate(d1);
  const inv = await makeInvite(d1, 'dono', 'student');
  const r = await api(d1, 'dono', 'POST', `/v1/academies/${A}/export`, { body: {} });
  assert.equal(r.status, 200);
  const e = data(r);
  assert.equal(e.format, 'bohtreinar-gestao-export-v1');
  assert.deepEqual([e.academy.name, e.members.length, e.trainingVersions.length, e.trainingAssignments.length, e.consents.length], [NAME, 8, 1, 1, 1]);
  assert.equal(e.trainingVersions[0].exercises[0].name, 'Leg Press');
  assert.ok(e.invites.length >= 1 && e.audit.length > 3);
  assert.ok(Object.values(e.truncated).every((v) => v === false));
  const text = JSON.stringify(e);
  assert.ok(!text.includes(inv.code), 'o código do convite não pode estar na exportação');
  assert.ok(!/code_hash|email/i.test(text));
  assert.equal(audit(d1, 'academy.exported').length, 1);
  assert.ok(e.audit.some((x) => x.action === 'academy.exported'), 'a própria exportação aparece nela');
  for (const uid of ['adm', 'prof', 'rec', 'alu']) assert.equal(code(await api(d1, uid, 'POST', `/v1/academies/${A}/export`, { body: {} })), 'forbidden_role', uid);
  assert.equal(code(await api(d1, 'donoB', 'POST', `/v1/academies/${A}/export`, { body: {} })), 'no_membership');
  assert.ok(!JSON.stringify(data(await api(d1, 'donoB', 'POST', `/v1/academies/${B}/export`, { body: {} }))).includes('"alu"'));   // outra academia: só os dados dela
  assert.equal((await api(d1, 'dono', 'POST', `/v1/academies/${A}/export`, { body: { x: 1 } })).status, 400);
});

test('encerrar: confirmação exata, só o dono, idempotente; minimiza dados e trava a academia; a outra academia não muda', async () => {
  const d1 = world();
  const t = await populate(d1);
  const code0 = (await makeInvite(d1, 'dono', 'student')).code;
  const closeIt = (uid, body, k = key()) => api(d1, uid, 'POST', `/v1/academies/${A}/close`, { body, key: k });
  const beforeB = [count(d1, 'academy_members', 'WHERE academy_id = ?', B), count(d1, 'training_templates', 'WHERE academy_id = ?', B)];
  for (const uid of ['adm', 'prof', 'rec', 'alu']) assert.equal(code(await closeIt(uid, { confirmName: NAME, confirm: true })), 'forbidden_role', uid);
  assert.equal(code(await closeIt('donoB', { confirmName: NAME, confirm: true })), 'no_membership');
  for (const body of [{ confirmName: 'outro nome', confirm: true }, { confirmName: NAME }, { confirmName: NAME, confirm: false }, { confirmName: NAME, confirm: true, x: 1 }, { confirm: true }]) assert.equal((await closeIt('dono', body)).status, 400, JSON.stringify(body));
  assert.equal(code(await api(d1, 'dono', 'POST', `/v1/academies/${A}/close`, { body: { confirmName: NAME, confirm: true } })), 'idempotency_required');
  assert.equal(row(d1, 'SELECT closed_at c FROM academies WHERE id = ?', A).c, null);   // nada aconteceu até aqui
  const k = key();
  const ok = await closeIt('dono', { confirmName: NAME, confirm: true }, k);
  assert.deepEqual([ok.status, data(ok).status], [200, 'closed']);
  assert.deepEqual(data(await closeIt('dono', { confirmName: NAME, confirm: true }, k)), data(ok));   // repetir com a mesma chave (rede caiu): devolve o resultado salvo
  const acad = row(d1, 'SELECT status, closed_at FROM academies WHERE id = ?', A);
  assert.deepEqual([acad.status, !!acad.closed_at], ['suspended', true]);
  assert.equal(count(d1, 'academy_members', "WHERE academy_id = ? AND display_name <> ''", A), 0);
  assert.equal(count(d1, 'academy_members', "WHERE academy_id = ? AND role <> 'owner' AND status <> 'removed'", A), 0);
  assert.equal(count(d1, 'academy_members', "WHERE academy_id = ? AND status <> 'removed'", A), 0);                  // inclusive o dono
  assert.deepEqual({ ...row(d1, 'SELECT description d, contact_email c FROM academies WHERE id = ?', A) }, { d: '', c: '' });
  assert.equal(data(await api(d1, 'dono', 'GET', '/v1/academies')).academies.length, 0);                              // encerrada some da lista do dono
  assert.equal(data(await api(d1, 'dono', 'POST', '/v1/me/leave-all', { body: {} })).blocked.length, 0);              // e não bloqueia a saída de tudo
  assert.equal(count(d1, 'academy_invites', 'WHERE academy_id = ? AND revoked = 0', A), 0);
  assert.equal(count(d1, 'training_assignments', 'WHERE academy_id = ?', A), 0);
  assert.equal(count(d1, 'training_templates', "WHERE academy_id = ? AND status = 'active'", A), 0);
  assert.equal(count(d1, 'training_versions', 'WHERE academy_id = ?', A), 1);                       // versões ficam
  assert.equal(count(d1, 'coach_assignments', "WHERE academy_id = ? AND status = 'active'", A), 0);
  assert.equal(row(d1, "SELECT status FROM academy_consents WHERE academy_id = ? AND student_uid = 'alu'", A).status, 'revoked');
  assert.equal(count(d1, 'idempotency_keys', "WHERE academy_id LIKE ?", `${A}|%`), 1);   // só a chave do próprio encerramento (resposta sem dado pessoal)
  assert.equal(audit(d1, 'academy.closed').length, 1);
  assert.ok(audit(d1, 'training.published').length >= 1);                                          // auditoria anterior mantida
  assert.deepEqual([count(d1, 'academy_members', 'WHERE academy_id = ?', B), count(d1, 'training_templates', 'WHERE academy_id = ?', B)], beforeB);
  // acesso e entradas depois de encerrar
  for (const [uid, m, p, expected] of [['dono', 'GET', `/v1/academies/${A}/members`, 'no_membership'], ['alu', 'GET', `/v1/me/academies/${A}/training`, 'no_membership'], ['dono', 'POST', `/v1/academies/${A}/trainings`, 'no_membership']]) {
    assert.equal(code(await api(d1, uid, m, p, { body: m === 'POST' ? { name: 'Nova', exercises: EX } : undefined })), expected, `${uid} ${m} ${p}`);
  }
  assert.equal(code(await accept(d1, 'rec2x', code0)), 'invite_invalid');
  assert.equal(code(await closeIt('dono', { confirmName: NAME, confirm: true })), 'no_membership');   // segunda vez, outra chave: ninguém mais tem vínculo
  // garantias do banco
  assert.throws(() => d1.raw.prepare("INSERT INTO academy_members (academy_id, user_id, role, status, display_name, created_at, updated_at) VALUES (?, 'novo', 'student', 'active', 'x', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z')").run(A), /academy_closed/);
  assert.throws(() => d1.raw.prepare("UPDATE academies SET name = 'Reabrir' WHERE id = ?").run(A), /academy_closed/);
  assert.throws(() => d1.raw.prepare("UPDATE academy_members SET status = 'active', removed_at = NULL, removed_by = NULL WHERE academy_id = ? AND user_id = 'alu'").run(A), /academy_closed/);
  assert.throws(() => d1.raw.prepare("INSERT INTO academy_consents (academy_id, student_uid, share_adherence, status, granted_at, updated_at) VALUES (?, 'alu', 1, 'granted', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z')").run(A), /academy_closed|UNIQUE/);
  assert.throws(() => d1.raw.prepare('DELETE FROM academy_audit_log WHERE academy_id = ?').run(A), /immutable_audit/);
});

test('encerrar em lote grande: muitos membros num só batch e a outra academia intacta', async () => {
  const d1 = world();
  for (let i = 0; i < 120; i++) d1.raw.prepare("INSERT INTO academy_members (academy_id, user_id, role, status, display_name, created_at, updated_at) VALUES (?, ?, 'student', 'active', ?, '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z')").run(A, `massa${i}`, `Aluno ${i}`);
  const r = await api(d1, 'dono', 'POST', `/v1/academies/${A}/close`, { body: { confirmName: NAME, confirm: true }, key: key() });
  assert.equal(r.status, 200);
  assert.equal(count(d1, 'academy_members', "WHERE academy_id = ? AND (status <> 'removed' AND role <> 'owner')", A), 0);
  assert.equal(count(d1, 'academy_members', "WHERE academy_id = ? AND display_name <> ''", B), 7);
  assert.equal(count(d1, 'academy_members', "WHERE academy_id = ? AND status <> 'removed'", B), 7);
});

test('exportar os próprios dados: só o que é do titular, também com o desligador ligado', async () => {
  const d1 = world();
  await populate(d1);
  const mine = data(await api(d1, 'alu', 'GET', '/v1/me/export'));
  assert.equal(mine.format, 'bohtreinar-gestao-me-export-v1');
  assert.deepEqual([mine.memberships.map((m) => m.academy_id), mine.consents.length, mine.coachLinksAsStudent.length, mine.trainingAssignments.length], [[A], 1, 1, 1]);
  assert.equal(mine.coachLinksAsStudent[0].coach_name, 'Nome prof');
  assert.equal(mine.memberships[0].academy_name, NAME);
  assert.ok(Object.values(mine.truncated).every((v) => v === false));
  assert.equal(mine.trainingAssignments[0].exercises[0].name, 'Leg Press');
  assert.ok(!JSON.stringify(mine).includes('alu2'), 'nada de outros alunos');
  assert.ok(!JSON.stringify(mine).includes('"prof"') && !JSON.stringify(mine).includes('"dono"'), 'sem uids de outras pessoas');
  assert.equal(data(await api(d1, 'prof', 'GET', '/v1/me/export')).coachLinksAsCoach.length, 1);
  const other = data(await api(d1, 'alu2', 'GET', '/v1/me/export'));
  assert.deepEqual([other.consents.length, other.coachLinksAsStudent.length, other.trainingAssignments.length], [0, 0, 0]);
  assert.equal((await api(d1, 'alu', 'GET', '/v1/me/export', { env: { ADMIN_OPS_ENABLED: 'false' } })).status, 200);
  assert.equal(code(await api(d1, null, 'GET', '/v1/me/export')), 'no_token');
});

test('migração 0006 preserva a auditoria, cria closed_at e mantém a imutabilidade', () => {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const f of MIGRATIONS.filter((m) => m < '0006')) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  db.exec("INSERT INTO academies (id, name, status, created_at, updated_at) VALUES ('academiaaaaaaaaaaaa', 'ZZ', 'active', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z')");
  db.exec("INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id) VALUES ('x1', 'academiaaaaaaaaaaaa', 'u', 'academy.created', 'academy', 'a', '', '2026-10-14T00:00:00.000Z', 'r')");
  db.exec(readFileSync(new URL('0006_export_close.sql', dir), 'utf8'));
  assert.equal(db.prepare('SELECT count(*) n FROM academy_audit_log').get().n, 1);
  assert.equal(db.prepare('SELECT closed_at FROM academies').get().closed_at, null);
  db.exec("INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id) VALUES ('x2', 'academiaaaaaaaaaaaa', 'u', 'academy.closed', 'academy', 'a', '', '2026-10-14T00:00:00.000Z', 'r')");
  assert.throws(() => db.exec("UPDATE academy_audit_log SET detail = 'x'"), /immutable_audit/);
  assert.throws(() => db.exec('DELETE FROM academy_audit_log'), /immutable_audit/);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'academy_audit_log'").get().n, 2);
});
