// Segurança: duas academias fictícias com todos os papéis. Nenhum papel de uma alcança dados da outra, IDs do cliente nunca mudam a
// autoridade, e a auditoria nunca é forjada. Toda tentativa abaixo deve falhar SEM alterar nada.
import test from 'node:test';
import { A, B, accept, api, assert, audit, code, count, data, key, makeInvite, resetRateLimit, row, rows, world } from './kit.js';

test.beforeEach(() => resetRateLimit());
const ROLES_B = ['donoB', 'admB', 'profB', 'recB', 'aluB'];

// Uma foto do banco inteiro: se qualquer tentativa de B alterar algo da A, a foto muda.
const snapshot = (d1) => JSON.stringify(['academies', 'academy_members', 'academy_invites', 'coach_assignments', 'academy_consents', 'training_templates', 'training_versions', 'training_assignments', 'academy_audit_log']
  .map((t) => rows(d1, `SELECT * FROM ${t} WHERE ${t === 'academies' ? 'id' : 'academy_id'} = ? ORDER BY 1, 2`, A)));

async function setupA(d1) {
  const inv = await makeInvite(d1, 'dono', 'student', { maxUses: 5 });
  const pr = data(await api(d1, 'dono', 'POST', `/v1/academies/${A}/coach-assignments`, { body: { studentUid: 'alu', coachUid: 'prof' }, key: key() }));
  const tpl = data(await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings`, { body: { name: 'Perna', exercises: [{ name: 'Agachamento', sets: '3', reps: '10', rest: 60 }] } })).templateId;
  await api(d1, 'dono', 'POST', `/v1/academies/${A}/trainings/${tpl}/publish`, { body: {} });
  return { inv, assignmentId: pr.assignmentId, tpl };
}

test('nenhum papel da academia B lê ou altera qualquer coisa da academia A (todas as rotas, todos os papéis)', async () => {
  const d1 = world();
  const { inv, assignmentId, tpl } = await setupA(d1);
  const before = snapshot(d1);
  const attempts = [
    ['GET', `/v1/academies/${A}`], ['GET', `/v1/academies/${A}/profile`], ['GET', `/v1/academies/${A}/dashboard`], ['GET', `/v1/academies/${A}/members`],
    ['GET', `/v1/academies/${A}/invites`], ['GET', `/v1/academies/${A}/audit`], ['GET', `/v1/academies/${A}/coach/students`], ['GET', `/v1/academies/${A}/coach-assignments`],
    ['GET', `/v1/academies/${A}/trainings`], ['GET', `/v1/me/academies/${A}/consent`], ['GET', `/v1/me/academies/${A}/training`],
    ['PATCH', `/v1/academies/${A}`, { name: 'Sequestrada' }], ['POST', `/v1/academies/${A}/invites`, { role: 'admin' }, true],
    ['POST', `/v1/academies/${A}/invites/${inv.inviteId}/revoke`, {}], ['PATCH', `/v1/academies/${A}/members/alu/role`, { role: 'coach' }],
    ['POST', `/v1/academies/${A}/members/alu/suspend`, {}], ['POST', `/v1/academies/${A}/members/alu/remove`, {}], ['POST', `/v1/academies/${A}/members/dono/remove`, {}],
    ['POST', `/v1/academies/${A}/transfer-ownership`, { toUid: 'adm', confirm: true }, true], ['POST', `/v1/academies/${A}/coach-assignments`, { studentUid: 'alu2', coachUid: 'prof2' }, true],
    ['POST', `/v1/coach-assignments/${assignmentId}/approve`, {}], ['POST', `/v1/coach-assignments/${assignmentId}/accept`, {}], ['POST', `/v1/coach-assignments/${assignmentId}/reject`, {}], ['POST', `/v1/coach-assignments/${assignmentId}/revoke`, {}],
    ['POST', `/v1/academies/${A}/trainings`, { name: 'Invasora', exercises: [{ name: 'X', sets: '1', reps: '1', rest: 0 }] }], ['POST', `/v1/academies/${A}/trainings/${tpl}/publish`, {}], ['POST', `/v1/academies/${A}/trainings/${tpl}/assign`, { studentUid: 'alu' }],
    ['PUT', `/v1/me/academies/${A}/consent`, { shareAdherence: true }], ['POST', `/v1/me/academies/${A}/leave`, {}]
  ];
  let n = 0;
  for (const uid of ROLES_B) {
    for (const [method, path, body, needsKey] of attempts) {
      const r = await api(d1, uid, method, path, { body, key: needsKey ? key() : undefined, headers: { 'CF-Connecting-IP': `10.9.${Math.floor(n / 250)}.${(n++ % 250) + 1}` } });   // IPs distintos: o limite por IP não mascara o resultado
      assert.ok(r.status >= 400 && r.status < 500, `${uid} ${method} ${path} -> ${r.status}`);
      assert.ok(['no_membership', 'not_found', 'forbidden_role', 'membership_inactive'].includes(code(r)), `${uid} ${method} ${path} -> ${code(r)}`);
    }
  }
  assert.equal(snapshot(d1), before, 'a academia A mudou');
});

test('papéis da própria academia: cada um só faz o que a matriz permite (recepção não cria coach; aluno não altera papel; admin não cria admin)', async () => {
  const d1 = world();
  const deny = async (uid, method, path, body, expected = 'forbidden_role', k = false) => {
    const r = await api(d1, uid, method, path, { body, key: k ? key() : undefined });
    assert.equal(code(r), expected, `${uid} ${method} ${path}`);
  };
  await deny('rec', 'POST', `/v1/academies/${A}/invites`, { role: 'coach' }, 'forbidden_role', true);
  await deny('rec', 'POST', `/v1/academies/${A}/invites`, { role: 'admin' }, 'forbidden_role', true);
  await deny('adm', 'POST', `/v1/academies/${A}/invites`, { role: 'admin' }, 'forbidden_role', true);
  await deny('alu', 'PATCH', `/v1/academies/${A}/members/alu/role`, { role: 'owner' });
  await deny('alu', 'PATCH', `/v1/academies/${A}/members/alu2/role`, { role: 'coach' });
  await deny('prof', 'PATCH', `/v1/academies/${A}/members/alu/role`, { role: 'coach' });
  await deny('prof', 'POST', `/v1/academies/${A}/members/alu/suspend`, {});
  await deny('rec', 'POST', `/v1/academies/${A}/members/alu/remove`, {});
  await deny('adm', 'PATCH', `/v1/academies/${A}/members/dono/role`, { role: 'admin' });
  await deny('adm', 'POST', `/v1/academies/${A}/transfer-ownership`, { toUid: 'adm', confirm: true }, 'forbidden_role', true);
  await deny('prof', 'GET', `/v1/academies/${A}/audit`);
  await deny('rec', 'GET', `/v1/academies/${A}/audit`);
  await deny('alu', 'GET', `/v1/academies/${A}/members`);
  assert.deepEqual(rows(d1, "SELECT user_id, role FROM academy_members WHERE academy_id = ? AND user_id IN ('alu', 'alu2', 'adm', 'dono', 'rec', 'prof') ORDER BY 1", A).map((m) => m.role), ['admin', 'student', 'student', 'owner', 'coach', 'reception']);
});

test('convite de uma academia não vale na outra: o papel e a academia vêm da linha do convite, nunca do cliente', async () => {
  const d1 = world();
  const inv = await makeInvite(d1, 'dono', 'coach');
  const joined = data(await accept(d1, 'novo', inv.code));
  assert.equal(joined.academyId, A);
  assert.equal(count(d1, 'academy_members', "WHERE academy_id = ? AND user_id = 'novo'", B), 0);
  // o cliente tenta empurrar outra academia ou papel no corpo: o esquema fechado recusa tudo
  for (const extra of [{ academyId: B }, { role: 'owner' }, { academy: B }, { userId: 'dono' }]) assert.equal(code(await api(d1, 'outro', 'POST', '/v1/invites/accept', { body: { code: inv.code, ...extra } })), 'invite_invalid', JSON.stringify(extra));
  // convite revogado na A não é ressuscitado pela B
  const bInv = await makeInvite(d1, 'donoB', 'student', {}, B);
  assert.equal(data(await accept(d1, 'u2', bInv.code)).academyId, B);
  assert.equal(count(d1, 'academy_members', "WHERE user_id = 'u2' AND academy_id = ?", A), 0);
});

test('IDs enviados pelo cliente não mudam a autoridade: uid, academyId, role, actorUid e createdBy só valem se vierem do token ou da linha do banco', async () => {
  const d1 = world();
  const forged = [
    ['POST', '/v1/academies', { name: 'ZZ TESTE X', actorUid: 'dono' }], ['POST', '/v1/academies', { name: 'ZZ TESTE X', role: 'owner', academyId: A }],
    ['PATCH', `/v1/academies/${A}`, { description: 'x', createdBy: 'dono' }], ['POST', `/v1/academies/${A}/invites`, { role: 'student', createdBy: 'dono', actorUid: 'dono' }],
    ['PATCH', `/v1/academies/${A}/members/alu2/role`, { role: 'coach', actorUid: 'dono' }], ['POST', `/v1/academies/${A}/coach-assignments`, { studentUid: 'alu', coachUid: 'prof', proposedBy: 'dono', status: 'active' }]
  ];
  for (const [method, path, body] of forged) assert.equal((await api(d1, 'dono', method, path, { body, key: key() })).status, 400, `${method} ${path}`);
  // mesmo com o valor "certo" no corpo, quem manda é o token: aluno tentando agir como dono
  assert.equal(code(await api(d1, 'alu', 'PATCH', `/v1/academies/${A}`, { body: { description: 'x' } })), 'forbidden_role');
  // o ator da auditoria é SEMPRE o uid do token
  await api(d1, 'adm', 'POST', `/v1/academies/${A}/members/alu/suspend`, { body: {} });
  assert.deepEqual([...new Set(rows(d1, "SELECT actor_uid FROM academy_audit_log WHERE action = 'member.suspended'").map((l) => l.actor_uid))], ['adm']);
});

test('auditoria não pode ser forjada: nenhuma rota escreve ator, ação ou alvo do cliente; o banco recusa edição, remoção e ação inventada', async () => {
  const d1 = world();
  await api(d1, 'dono', 'PATCH', `/v1/academies/${A}`, { body: { description: 'ok' } });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.ok([404, 405].includes((await api(d1, 'dono', method, `/v1/academies/${A}/audit`, { body: { action: 'academy.created', actorUid: 'adm' } })).status), method);
  const [entry] = audit(d1, 'academy.updated');
  assert.equal(entry.actor_uid, 'dono');
  assert.throws(() => d1.raw.prepare("UPDATE academy_audit_log SET actor_uid = 'adm' WHERE id = ?").run(entry.id), /immutable_audit/);
  assert.throws(() => d1.raw.prepare('DELETE FROM academy_audit_log WHERE id = ?').run(entry.id), /immutable_audit/);
  assert.throws(() => d1.raw.prepare("INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, created_at) VALUES ('forjado0000000000001', ?, 'adm', 'academy.explodiu', 'academy', 'x', '2026-10-14T00:00:00.000Z')").run(A), /CHECK/);
  // a leitura da auditoria da B não traz nada da A, e a da A não traz nada da B
  await api(d1, 'donoB', 'PATCH', `/v1/academies/${B}`, { body: { description: 'b' } });
  const a = data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/audit`)).entries;
  const b = data(await api(d1, 'donoB', 'GET', `/v1/academies/${B}/audit`)).entries;
  assert.ok(a.length && b.length);
  assert.ok(a.every((e) => rows(d1, 'SELECT academy_id FROM academy_audit_log WHERE id = ?', e.id)[0].academy_id === A));
  assert.ok(b.every((e) => rows(d1, 'SELECT academy_id FROM academy_audit_log WHERE id = ?', e.id)[0].academy_id === B));
});

test('auditoria: paginada por cursor, decrescente, com nomes públicos e sem dado sensível; limite máximo imposto', async () => {
  const d1 = world();
  for (let i = 0; i < 7; i += 1) await api(d1, 'dono', 'PATCH', `/v1/academies/${A}`, { body: { description: `v${i}` } });
  const p1 = data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/audit?limit=3`));
  assert.equal(p1.entries.length, 3);
  assert.ok(p1.nextBefore);
  const p2 = data(await api(d1, 'adm', 'GET', `/v1/academies/${A}/audit?limit=3&before=${p1.nextBefore}`));
  const ids = [...p1.entries, ...p2.entries].map((e) => e.id);
  assert.equal(new Set(ids).size, 6);                                                              // páginas não se repetem
  const all = data(await api(d1, 'dono', 'GET', `/v1/academies/${A}/audit?limit=50`));
  assert.equal(all.entries.length, 7);
  assert.equal(all.nextBefore, null);
  assert.deepEqual(Object.keys(all.entries[0]).sort(), ['action', 'actorName', 'actorUid', 'at', 'detail', 'id', 'requestId', 'targetId', 'targetName', 'targetType']);
  assert.equal(all.entries[0].actorName, 'Nome dono');
  for (const bad of ['?limit=51', '?limit=0', '?before=0', '?before=abc', '?limit=1.5']) assert.equal(code(await api(d1, 'dono', 'GET', `/v1/academies/${A}/audit${bad}`)), 'invalid_request', bad);
  assert.ok(!JSON.stringify(all).includes('weight') && !JSON.stringify(all).includes('email'));
});

test('nenhuma resposta de nenhuma rota expõe peso, medidas, cargas, volume, saúde, frequência individual, e-mail ou telefone', async () => {
  const d1 = world();
  const { inv } = await setupA(d1);
  await api(d1, 'alu', 'PUT', `/v1/me/academies/${A}/consent`, { body: { shareAdherence: true } });
  const paths = [`/v1/academies/${A}`, `/v1/academies/${A}/profile`, `/v1/academies/${A}/dashboard`, `/v1/academies/${A}/members`, `/v1/academies/${A}/invites`, `/v1/academies/${A}/audit`,
    `/v1/academies/${A}/coach-assignments`, `/v1/academies/${A}/trainings`, '/v1/me', '/v1/academies', '/v1/me/coach-assignments'];
  for (const p of paths) {
    // ids aleatórios (24 letras/números) podem conter 'cpf' ou 'peso' por acaso: saem da busca de palavras proibidas
    const text = JSON.stringify((await api(d1, 'dono', 'GET', p)).json).toLowerCase().replace(/[a-z0-9]{24}/g, '');
    for (const banned of ['weight', 'peso', 'height', 'altura', 'measure', 'medida', 'carga', 'volume', 'health', 'saude', 'saúde', 'streak', 'phone', 'telefone', 'cpf', '@']) assert.ok(!text.includes(banned), `${p} contém ${banned}`);
    assert.ok(!text.includes(inv.code), `${p} expõe o código do convite`);
  }
  assert.ok(row(d1, 'SELECT 1 AS ok'));
});
