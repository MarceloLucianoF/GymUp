// Regressões dos achados da revisão independente do Worker (cada teste prova uma correção).
import test from 'node:test';
import { A, DAY, T0, accept, api, assert, audit, code, count, data, key, makeInvite, resetRateLimit, row, rows, world } from './kit.js';
import { parse, SCHEMAS } from '../../shared/academy-contracts/index.js';

test.beforeEach(() => resetRateLimit());
const propose = (d1, uid, body) => api(d1, uid, 'POST', `/v1/academies/${A}/coach-assignments`, { body, key: key() });

test('transferir propriedade: se o alvo mudou no meio, NADA muda e nenhuma chave de idempotência de "sucesso" fica salva', async () => {
  const d1 = world();
  const real = d1.batch.bind(d1);
  d1.batch = async (stmts) => {
    if (stmts.some((s) => s.sql.includes("SET role = 'owner'"))) d1.raw.prepare("UPDATE academy_members SET role = 'student' WHERE academy_id = ? AND user_id = 'adm'").run(A);   // alvo rebaixado entre a leitura e a escrita
    return real(stmts);
  };
  const k = key();
  const r = await api(d1, 'dono', 'POST', `/v1/academies/${A}/transfer-ownership`, { body: { toUid: 'adm', confirm: true }, key: k });
  assert.deepEqual([r.status, code(r)], [409, 'conflict']);
  assert.equal(row(d1, "SELECT role FROM academy_members WHERE academy_id = ? AND user_id = 'dono'", A).role, 'owner');
  assert.equal(count(d1, 'idempotency_keys'), 0);
  assert.equal(audit(d1, 'ownership.transferred').length, 0);
});

test('coach nunca vê aluno antes do aceite: lista só vínculos ativos e as propostas que ele mesmo fez', async () => {
  const d1 = world();
  await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof' });          // proposta do dono: pending_student
  const own = data(await propose(d1, 'prof', { studentUid: 'alu2' }));         // proposta do próprio coach
  const list = async () => data(await api(d1, 'prof', 'GET', `/v1/academies/${A}/coach-assignments`)).assignments;
  assert.deepEqual((await list()).map((a) => [a.studentUid, a.status]), [['alu2', 'proposed']]);   // 'alu' (pending_student do dono) não aparece
  const full = data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/coach-assignments`)).assignments;
  assert.equal(full.length, 2);
  assert.ok(own.assignmentId);
});

test('convite só vale enquanto quem o criou continua ativo e com permissão para aquele papel', async () => {
  const d1 = world();
  const byAdm = await makeInvite(d1, 'adm', 'coach', { maxUses: 5 });
  const byRec = await makeInvite(d1, 'rec', 'student', { maxUses: 5 });
  const byDono = await makeInvite(d1, 'dono', 'admin', { maxUses: 5 });
  assert.equal((await api(d1, 'n1', 'POST', '/v1/invites/preview', { body: { code: byAdm.code } })).status, 200);
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/members/adm/suspend`, { body: {} });          // criador suspenso
  assert.equal(code(await api(d1, 'n1', 'POST', '/v1/invites/preview', { body: { code: byAdm.code } })), 'invite_invalid');
  assert.equal(code(await accept(d1, 'n1', byAdm.code)), 'invite_invalid');
  assert.equal(count(d1, 'academy_members', "WHERE user_id = 'n1'"), 0);
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/members/adm/reactivate`, { body: {} });
  assert.equal((await accept(d1, 'n1', byAdm.code)).status, 200);                                  // voltou a valer
  await api(d1, 'dono', 'PATCH', `/v1/academies/${A}/members/rec/role`, { body: { role: 'coach' } });   // recepção rebaixada: não pode mais convidar aluno
  assert.equal(code(await accept(d1, 'n2', byRec.code)), 'invite_invalid');
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/members/adm/remove`, { body: {} });
  assert.equal((await accept(d1, 'n3', byDono.code)).status, 200);                                 // convite de admin criado pelo DONO segue valendo
  assert.equal(row(d1, "SELECT role FROM academy_members WHERE user_id = 'n3'").role, 'admin');
  // convite de admin criado por um admin (impossível pela API) também seria recusado: o banco e o portão exigem dono
  d1.raw.prepare("UPDATE academy_members SET role = 'admin', status = 'active', removed_at = NULL, removed_by = NULL WHERE academy_id = ? AND user_id = 'adm'").run(A);
  d1.raw.prepare("INSERT INTO academy_invites (id, academy_id, code_hash, role, max_uses, expires_at, created_by, created_at, updated_at) VALUES ('forjado', ?, ?, 'admin', 5, '2099-01-01T00:00:00.000Z', 'adm', ?, ?)").run(A, 'a'.repeat(64), '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z');
  const { sha256Hex } = await import('../src/db.js');
  d1.raw.prepare("UPDATE academy_invites SET code_hash = ? WHERE id = 'forjado'").run(await sha256Hex('f'.repeat(32)));
  assert.equal(code(await accept(d1, 'n4', 'f'.repeat(32))), 'invite_invalid');
});

test('quem sai ou é removido perde a ficha atribuída; ao voltar por convite ela não reaparece; o consentimento não é restaurado', async () => {
  const d1 = world();
  const tpl = data(await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings`, { body: { name: 'Perna', exercises: [{ name: 'Agachamento', sets: '3', reps: '10', rest: 60 }] } })).templateId;
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings/${tpl}/publish`, { body: {} });
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings/${tpl}/assign`, { body: { studentUid: 'alu' } });
  await api(d1, 'alu', 'PUT', `/v1/me/academies/${A}/consent`, { body: { shareAdherence: true } });
  assert.ok(data(await api(d1, 'alu', 'GET', `/v1/me/academies/${A}/training`)).training);
  await api(d1, 'alu', 'POST', `/v1/me/academies/${A}/leave`, { body: {} });
  assert.equal(count(d1, 'training_assignments'), 0);
  const inv = await makeInvite(d1, 'dono', 'student');
  assert.equal((await accept(d1, 'alu', inv.code)).status, 200);
  assert.deepEqual(data(await api(d1, 'alu', 'GET', `/v1/me/academies/${A}/training`)), { training: null });
  assert.equal(data(await api(d1, 'alu', 'GET', `/v1/me/academies/${A}/consent`)).shareAdherence, false);
});

test('coach só troca a ficha que ele mesmo atribuiu; dono e admin trocam qualquer uma', async () => {
  const d1 = world();
  d1.raw.prepare("UPDATE academy_members SET can_create_trainings = 1 WHERE academy_id = ? AND user_id = 'prof'").run(A);
  const mk = async (name) => { const id = data(await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings`, { body: { name, exercises: [{ name: 'X', sets: '3', reps: '10', rest: 60 }] } })).templateId; await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings/${id}/publish`, { body: {} }); return id; };
  const [t1, t2] = [await mk('Ficha 1'), await mk('Ficha 2')];
  const link = data(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof' })).assignmentId;
  await api(d1, 'alu', 'POST', `/v1/coach-assignments/${link}/accept`, { body: {} });
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/trainings/${t1}/assign`, { body: { studentUid: 'alu' } });
  assert.equal(code(await api(d1, 'prof', 'POST', `/v1/academies/${A}/trainings/${t2}/assign`, { body: { studentUid: 'alu' } })), 'conflict');   // não sobrescreve a do admin
  assert.equal(row(d1, "SELECT template_id FROM training_assignments WHERE student_uid = 'alu'").template_id, t1);
  assert.equal((await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings/${t2}/assign`, { body: { studentUid: 'alu' } })).status, 200);
  assert.equal(code(await api(d1, 'prof', 'POST', `/v1/academies/${A}/trainings/${t1}/assign`, { body: { studentUid: 'alu' } })), 'conflict');   // a ficha agora é a do dono
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/trainings/${t1}/assign`, { body: { studentUid: 'alu' } });                                 // admin reatribui à vontade
  assert.equal(row(d1, "SELECT assigned_by FROM training_assignments WHERE student_uid = 'alu'").assigned_by, 'adm');
});

test('imagem do exercício: só vazio, https ou caminho interno de mídia; qualquer outra coisa é recusada', async () => {
  const d1 = world();
  const ex = (machineImage) => ({ name: 'A', sets: '3', reps: '10', rest: 60, machineImage });
  for (const ok of ['', 'https://cdn.exemplo.org/a.jpg', '/exercicios/agachamento.jpg', '/exercises/agachamento.gif']) assert.equal((await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings`, { body: { name: 'Ok', exercises: [ex(ok)] } })).status, 200, ok);
  for (const bad of ['http://x.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//x.com/a.jpg', '/etc/passwd', 'https://a b.com']) assert.equal((await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings`, { body: { name: 'Ruim', exercises: [ex(bad)] } })).status, 400, bad);
});

test('nome de exibição: só o nome da conta, sem < > nem controle; sem nome vira "Usuário xxxx" (e-mail nunca é usado); anônimo é recusado', async () => {
  const d1 = world();
  const mk = (uid, claims, k) => api(d1, uid, 'POST', '/v1/academies', { body: { name: 'ZZ TESTE Nome' }, key: k, claims });
  const name = (uid) => row(d1, 'SELECT display_name FROM academy_members WHERE user_id = ?', uid).display_name;
  await mk('abcd1234', { name: '<img src=x onerror=alert(1)>Maria\u0007', email: 'maria@example.invalid' }, key());
  await mk('wxyz9876', { name: undefined, email: 'joao@example.invalid' }, key());
  assert.equal(name('abcd1234'), 'img src=x onerror=alert(1)Maria');
  assert.equal(name('wxyz9876'), 'Usuário wxyz');
  assert.ok(!rows(d1, 'SELECT display_name FROM academy_members').some((m) => /joao|maria@/.test(m.display_name)));
  const anon = await mk('anon1', { firebase: { sign_in_provider: 'anonymous' } }, key());
  assert.deepEqual([anon.status, code(anon)], [401, 'invalid_token']);
  assert.equal(count(d1, 'academy_members', "WHERE user_id = 'anon1'"), 0);
});

test('limite por academia é por (academia, usuário): um membro muito ativo não trava os colegas', async () => {
  const d1 = world();
  let r;
  for (let i = 0; i < 121; i += 1) r = await api(d1, 'dono', 'GET', `/v1/academies/${A}`, { headers: { 'CF-Connecting-IP': `10.5.${Math.floor(i / 250)}.${(i % 250) + 1}` }, env: { } });
  assert.ok([200, 429].includes(r.status));
  resetRateLimit();
  let blocked = 0;
  for (let i = 0; i < 125; i += 1) { const x = await api(d1, 'dono', 'GET', `/v1/academies/${A}`, { headers: { 'CF-Connecting-IP': `10.6.${Math.floor(i / 250)}.${(i % 250) + 1}` } }); if (x.status === 429) blocked += 1; }
  assert.ok(blocked >= 1);   // 'dono' passou do limite pessoal, mas por (academia, usuário) e não pela academia inteira:
  assert.equal((await api(d1, 'adm', 'GET', `/v1/academies/${A}`, { headers: { 'CF-Connecting-IP': '10.7.0.1' } })).status, 200);
});

test('dashboard da recepção conta só convites que ela pode criar (aluno)', async () => {
  const d1 = world();
  await makeInvite(d1, 'dono', 'admin'); await makeInvite(d1, 'dono', 'coach'); await makeInvite(d1, 'dono', 'student');
  assert.equal(data(await api(d1, 'rec', 'GET', `/v1/academies/${A}/dashboard`)).counts.pendingInvites, 1);
  assert.equal(data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/dashboard`)).counts.pendingInvites, 3);
});

test('transferência de professor: a auditoria do encerramento aponta o vínculo ANTIGO, e o aceite aponta o novo', async () => {
  const d1 = world();
  const a1 = data(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof' })).assignmentId;
  await api(d1, 'alu', 'POST', `/v1/coach-assignments/${a1}/accept`, { body: {} });
  const a2 = data(await propose(d1, 'dono', { studentUid: 'alu', coachUid: 'prof2' })).assignmentId;
  await api(d1, 'alu', 'POST', `/v1/coach-assignments/${a2}/accept`, { body: {} });
  assert.equal(audit(d1, 'coach.revoked')[0].target_id, a1);
  assert.equal(audit(d1, 'coach.accepted').map((l) => l.target_id).join(), [a1, a2].join());
});

test('idempotência expira em 24 h: a chave antiga é ignorada e apagada na próxima gravação', async () => {
  const d1 = world();
  const k = key();
  const first = await api(d1, 'novo', 'POST', '/v1/academies', { body: { name: 'ZZ TESTE Antiga' }, key: k });
  assert.equal(first.status, 200);
  const later = await api(d1, 'novo', 'POST', '/v1/academies', { body: { name: 'ZZ TESTE Nova' }, key: k, now: T0 + DAY + 3_600_000 });   // 25 h depois, outro corpo: é uma operação nova
  assert.equal(later.status, 200);
  assert.notEqual(data(later).academyId, data(first).academyId);
  assert.equal(count(d1, 'idempotency_keys'), 1);   // a antiga foi apagada
});

test('esquema de validação: chaves herdadas do protótipo (constructor, __proto__, toString) são recusadas', () => {
  for (const k of ['constructor', 'toString', 'hasOwnProperty']) assert.equal(parse(SCHEMAS.createAcademy, { name: 'Ok', [k]: 1 }).ok, false, k);
  assert.equal(parse(SCHEMAS.createAcademy, JSON.parse('{"name":"Ok","__proto__":{"role":"owner"}}')).ok, false);
});
