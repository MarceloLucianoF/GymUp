import test from 'node:test';
import { A, B, C, DAY, T0, accept, api, assert, audit, code, count, data, key, makeInvite, resetRateLimit, row, rows, seedMember, world } from './kit.js';

test.beforeEach(() => resetRateLimit());
const inviteUrl = (aid = A) => `/v1/academies/${aid}/invites`;
const create = (d1, uid, body, k = key()) => api(d1, uid, 'POST', inviteUrl(), { body, key: k });
const preview = (d1, uid, c, opts) => api(d1, uid, 'POST', '/v1/invites/preview', { body: { code: c }, ...opts });

test('criar: código de 32 caracteres aparece uma vez; no banco só o hash; a idempotência também não guarda o código; lista nunca mostra código', async () => {
  const d1 = world();
  const k = key();
  const r = await create(d1, 'dono', { role: 'student', maxUses: 3, expiresInDays: 5 }, k);
  assert.equal(r.status, 200);
  const inv = data(r);
  assert.match(inv.code, /^[a-z0-9]{32}$/);
  assert.equal(inv.expiresAt, new Date(T0 + 5 * DAY).toISOString());
  const stored = row(d1, 'SELECT * FROM academy_invites WHERE id = ?', inv.inviteId);
  assert.equal(stored.code_hash.length, 64);
  for (const table of ['academy_invites', 'idempotency_keys', 'academy_audit_log']) assert.ok(!JSON.stringify(rows(d1, `SELECT * FROM ${table}`)).includes(inv.code), `código em ${table}`);
  // repetição com a mesma chave: mesmo convite, sem código (só aparece uma vez) e nada novo
  const again = data(await create(d1, 'dono', { role: 'student', maxUses: 3, expiresInDays: 5 }, k));
  assert.deepEqual([again.inviteId, again.code, again.replayed], [inv.inviteId, null, true]);
  assert.equal(count(d1, 'academy_invites'), 1);
  const list = data(await api(d1, 'adm', 'GET', inviteUrl()));
  assert.equal(list.total, 1);
  assert.ok(!JSON.stringify(list).includes(inv.code) && !JSON.stringify(list).includes(stored.code_hash));
  assert.deepEqual(list.invites[0], { inviteId: inv.inviteId, role: 'student', maxUses: 3, uses: 0, expiresAt: inv.expiresAt, status: 'active', createdAt: list.invites[0].createdAt, createdByName: 'Nome dono' });
  assert.equal(audit(d1, 'invite.created').length, 1);
});

test('criar: matriz de papéis (admin não cria admin; recepção só aluno; coach, aluno e estranho não criam; ninguém cria dono)', async () => {
  const d1 = world();
  const mk = (uid, role) => create(d1, uid, { role });
  assert.equal((await mk('dono', 'admin')).status, 200);
  assert.equal(code(await mk('adm', 'admin')), 'forbidden_role');
  assert.equal((await mk('adm', 'coach')).status, 200);
  assert.equal((await mk('rec', 'student')).status, 200);
  assert.equal(code(await mk('rec', 'coach')), 'forbidden_role');
  assert.equal(code(await mk('rec', 'reception')), 'forbidden_role');
  for (const uid of ['prof', 'alu']) assert.equal(code(await mk(uid, 'student')), 'forbidden_role', uid);
  assert.equal(code(await mk('estranho', 'student')), 'no_membership');
  assert.equal(code(await mk('dono', 'owner')), 'invalid_request');                  // 'owner' nem existe como papel de convite
  assert.equal(code(await create(d1, 'dono', { role: 'student' }, 'curta')), 'idempotency_required');
});

test('criar: payload inválido ou com campo extra é recusado e nada é gravado', async () => {
  const d1 = world();
  for (const body of [{}, { role: 'superuser' }, { role: 'student', maxUses: 0 }, { role: 'student', maxUses: 501 }, { role: 'student', expiresInDays: 0 }, { role: 'student', expiresInDays: 31 }, { role: 'student', maxUses: 1.5 }, { role: 'student', academyId: B }, { role: 'student', createdBy: 'x' }, { role: 'student', code: 'a'.repeat(32) }]) {
    assert.equal((await create(d1, 'dono', body)).status, 400, JSON.stringify(body));
  }
  assert.equal(count(d1, 'academy_invites'), 0);
});

test('prévia: mostra só academia e papel sem consumir uso; inexistente, malformado, expirado, revogado, esgotado e academia suspensa dão o MESMO erro', async () => {
  const d1 = world();
  const i = await makeInvite(d1, 'dono', 'student', { maxUses: 1 });
  const prev = await preview(d1, 'novo', i.code);
  assert.deepEqual(Object.keys(data(prev)).sort(), ['academyName', 'expiresAt', 'role']);
  assert.equal(row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses, 0);   // prévia não consome
  const errs = [];
  for (const c of ['a'.repeat(32), 'curto', `${i.code}x`, 'A'.repeat(32), 123, null, '']) errs.push(code(await preview(d1, 'novo', c)));
  errs.push(code(await api(d1, 'novo', 'POST', '/v1/invites/preview', { body: {} })));
  errs.push(code(await preview(d1, 'novo', i.code, { now: T0 + 8 * DAY })));                     // expirado
  assert.deepEqual(new Set(errs), new Set(['invite_invalid']));
  assert.equal((await api(d1, 'novo', 'POST', '/v1/invites/preview', { body: { code: i.code, extra: 1 } })).json.error.code, 'invite_invalid');
  await api(d1, 'dono', 'POST', `${inviteUrl()}/${i.inviteId}/revoke`, { body: {} });
  assert.equal(code(await preview(d1, 'novo', i.code)), 'invite_invalid');                       // revogado
  const full = await makeInvite(d1, 'dono', 'student', { maxUses: 1 });
  await accept(d1, 'u1', full.code);
  assert.equal(code(await preview(d1, 'novo', full.code)), 'invite_invalid');                    // esgotado
  const susp = await makeInvite(d1, 'dono', 'student');
  d1.raw.prepare("UPDATE academies SET status = 'suspended' WHERE id = ?").run(A);
  assert.equal(code(await preview(d1, 'novo', susp.code)), 'invite_invalid');                    // academia suspensa
  assert.equal((await api(d1, 'novo', 'GET', `/v1/invites/${i.code}`)).status, 404);              // o código não é aceito na URL
});

test('aceitar: vira membro com o papel do CONVITE (não do corpo), uso somado e auditoria juntos; quem já é membro recebe already_member sem gastar uso', async () => {
  const d1 = world();
  const i = await makeInvite(d1, 'dono', 'coach', { maxUses: 2 });
  assert.equal(code(await api(d1, 'novo', 'POST', '/v1/invites/accept', { body: { code: i.code, role: 'owner' } })), 'invite_invalid');   // corpo com role
  assert.equal(count(d1, 'academy_members', "WHERE user_id = 'novo'"), 0);
  const r = await accept(d1, 'novo', i.code, { claims: { name: 'Maria' } });
  assert.deepEqual(data(r), { academyId: A, academyName: 'ZZ TESTE Gestão A', role: 'coach' });
  const m = row(d1, "SELECT role, status, display_name FROM academy_members WHERE user_id = 'novo'");
  assert.deepEqual([m.role, m.status, m.display_name], ['coach', 'active', 'Maria']);
  assert.equal(row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses, 1);
  const [log] = audit(d1, 'member.joined');
  assert.deepEqual([log.actor_uid, log.target_id, log.detail, log.request_id], ['novo', 'novo', 'coach', r.json.requestId]);
  assert.equal(code(await accept(d1, 'novo', i.code)), 'already_member');
  assert.equal(row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses, 1);
});

test('aceitar: esgotado, expirado, revogado e academia suspensa não gravam nada; dois usuários disputando o último uso: só um entra', async () => {
  const d1 = world();
  const i = await makeInvite(d1, 'dono', 'student', { maxUses: 2 });
  for (const uid of ['u1', 'u2']) assert.equal((await accept(d1, uid, i.code)).status, 200);
  const before = count(d1, 'academy_members');
  assert.equal(code(await accept(d1, 'u3', i.code)), 'invite_invalid');
  assert.deepEqual([count(d1, 'academy_members'), row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses], [before, 2]);
  const e = await makeInvite(d1, 'dono', 'student');
  assert.equal(code(await accept(d1, 'u4', e.code, { now: T0 + 9 * DAY })), 'invite_invalid');
  const rv = await makeInvite(d1, 'dono', 'student');
  await api(d1, 'dono', 'POST', `${inviteUrl()}/${rv.inviteId}/revoke`, { body: {} });
  assert.equal(code(await accept(d1, 'u5', rv.code)), 'invite_invalid');
  const s = await makeInvite(d1, 'dono', 'student');
  d1.raw.prepare("UPDATE academies SET status = 'suspended' WHERE id = ?").run(A);
  assert.equal(code(await accept(d1, 'u6', s.code)), 'invite_invalid');
  assert.equal(count(d1, 'academy_members', "WHERE user_id IN ('u3','u4','u5','u6')"), 0);

  // disputa real: a leitura do segundo usuário acontece ANTES do primeiro gravar (o portão no batch decide)
  const d2 = world();
  const last = await makeInvite(d2, 'dono', 'student', { maxUses: 1 });
  const real = d2.batch.bind(d2);
  let slipped = false;
  d2.batch = async (stmts) => {
    if (!slipped && stmts[0].sql.includes('UPDATE academy_invites SET uses = uses + 1')) { slipped = true; await accept(d2, 'primeiro', last.code); }   // o primeiro entra no meio
    return real(stmts);
  };
  const second = await accept(d2, 'segundo', last.code);
  assert.equal(code(second), 'invite_invalid');
  assert.equal(count(d2, 'academy_members', "WHERE user_id IN ('primeiro','segundo')"), 1);
  assert.equal(row(d2, 'SELECT uses FROM academy_invites WHERE id = ?', last.inviteId).uses, 1);
  assert.equal(audit(d2, 'member.joined').length, 1);
});

test('aceitar: suspenso, pendente e removido pela equipe não voltam por convite; quem saiu volta', async () => {
  const d1 = world();
  seedMember(d1, A, 'pend', 'student', 'pending');
  seedMember(d1, A, 'rem', 'student', 'removed');   // removido por "someone", não por ele mesmo
  const i = await makeInvite(d1, 'dono', 'coach', { maxUses: 10 });
  for (const uid of ['susp', 'pend', 'rem']) assert.equal(code(await accept(d1, uid, i.code)), 'conflict', uid);
  assert.equal(row(d1, 'SELECT uses FROM academy_invites WHERE id = ?', i.inviteId).uses, 0);
  await api(d1, 'alu', 'POST', `/v1/me/academies/${A}/leave`, { body: {} });
  assert.equal((await accept(d1, 'alu', i.code)).status, 200);
  assert.equal(row(d1, "SELECT role FROM academy_members WHERE user_id = 'alu' AND academy_id = ?", A).role, 'coach');
});

test('revogar: auditado, só da própria academia, dentro do papel; repetir é inofensivo; convite de outra academia é not_found', async () => {
  const d1 = world();
  const adm = await makeInvite(d1, 'dono', 'admin');
  const stu = await makeInvite(d1, 'dono', 'student');
  const bInv = await makeInvite(d1, 'donoB', 'student', {}, B);
  const rev = (uid, id, aid = A) => api(d1, uid, 'POST', `${inviteUrl(aid)}/${id}/revoke`, { body: {} });
  assert.equal(code(await rev('adm', adm.inviteId)), 'forbidden_role');              // admin não mexe em convite de admin
  assert.equal(code(await rev('rec', adm.inviteId)), 'forbidden_role');
  for (const uid of ['prof', 'alu']) assert.equal(code(await rev(uid, stu.inviteId)), 'forbidden_role', uid);
  assert.equal(code(await rev('dono', bInv.inviteId)), 'not_found');                 // id de convite da B na URL da A
  assert.equal(code(await rev('dono', bInv.inviteId, B)), 'no_membership');          // e a URL da B é inacessível
  assert.equal((await rev('rec', stu.inviteId)).status, 200);                        // recepção revoga convite de aluno
  assert.equal((await rev('dono', stu.inviteId)).status, 200);                       // repetir: 200 sem duplicar auditoria
  assert.equal(audit(d1, 'invite.revoked').length, 1);
  assert.equal(row(d1, 'SELECT revoked FROM academy_invites WHERE id = ?', bInv.inviteId).revoked, 0);
});

test('lista: cada função só vê os convites que pode criar; paginada; status derivado (ativo, esgotado, expirado, revogado)', async () => {
  const d1 = world();
  const a = await makeInvite(d1, 'dono', 'admin'); await makeInvite(d1, 'dono', 'coach'); const s = await makeInvite(d1, 'dono', 'student', { maxUses: 1 });
  await accept(d1, 'u1', s.code);
  const exp = await makeInvite(d1, 'dono', 'student', { expiresInDays: 1 });
  const rv = await makeInvite(d1, 'dono', 'student');
  await api(d1, 'dono', 'POST', `${inviteUrl()}/${rv.inviteId}/revoke`, { body: {} });
  const rec = data(await api(d1, 'rec', 'GET', inviteUrl()));
  assert.ok(rec.invites.every((i) => i.role === 'student') && rec.total === 3);
  assert.equal(data(await api(d1, 'adm', 'GET', inviteUrl())).total, 4);             // admin não vê o convite de admin
  const owner = data(await api(d1, 'dono', 'GET', inviteUrl()));
  assert.equal(owner.total, 5);
  const states = Object.fromEntries(owner.invites.map((i) => [i.inviteId, i.status]));
  assert.deepEqual([states[a.inviteId], states[s.inviteId], states[rv.inviteId]], ['active', 'exhausted', 'revoked']);
  const later = data(await api(d1, 'dono', 'GET', inviteUrl(), { now: T0 + 2 * DAY }));
  assert.equal(later.invites.find((i) => i.inviteId === exp.inviteId).status, 'expired');
  const p = data(await api(d1, 'dono', 'GET', `${inviteUrl()}?pageSize=2&page=3`));
  assert.deepEqual([p.invites.length, p.total], [1, 5]);
  assert.equal(code(await api(d1, 'dono', 'GET', `${inviteUrl()}?pageSize=99`)), 'invalid_request');
  for (const uid of ['prof', 'alu']) assert.equal(code(await api(d1, uid, 'GET', inviteUrl())), 'forbidden_role', uid);
  assert.ok(C);
});
