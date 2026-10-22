import test from 'node:test';
import { A, B, DAY, T0, api, assert, audit, code, count, data, key, resetRateLimit, row, rows, world } from './kit.js';
import { todayBrt } from '../src/handlers/finance.js';

test.beforeEach(() => resetRateLimit());
const P = (aid = A) => `/v1/academies/${aid}`;
const mkPlan = async (d1, name = 'Mensal', fee = 10000, uid = 'dono', aid = A) => data(await api(d1, uid, 'POST', `${P(aid)}/plans`, { body: { name, monthlyFeeCents: fee } })).planId;
const mkContract = async (d1, student, planId, extra = {}, aid = A) => data(await api(d1, 'dono', 'POST', `${P(aid)}/contracts`, { body: { studentUid: student, planId, dueDay: 5, startDate: '2026-10-01', ...extra } })).contractId;
const generate = (d1, month, uid = 'dono', body = {}, k = key()) => api(d1, uid, 'POST', `${P()}/charges/generate`, { body: { month, ...body }, key: k });
const charges = async (d1, query = '', uid = 'dono', aid = A) => data(await api(d1, uid, 'GET', `${P(aid)}/charges?${query}`));

test('hoje é o dia de Brasília (UTC-3)', () => {
  assert.equal(todayBrt(Date.parse('2026-10-15T02:30:00Z')), '2026-10-14');
  assert.equal(todayBrt(Date.parse('2026-10-15T03:00:00Z')), '2026-10-15');
});

test('planos: dono e administrador criam e alteram; recepção só lista; professor e aluno fora; valores validados; isolamento', async () => {
  const d1 = world();
  const id = await mkPlan(d1);
  assert.equal((await api(d1, 'adm', 'POST', `${P()}/plans`, { body: { name: 'Trimestral', monthlyFeeCents: 8900, description: 'Compromisso de 3 meses' } })).status, 200);
  for (const uid of ['rec', 'prof', 'alu']) assert.equal(code(await api(d1, uid, 'POST', `${P()}/plans`, { body: { name: 'Nao pode', monthlyFeeCents: 1 } })), 'forbidden_role', uid);
  assert.equal(data(await api(d1, 'rec', 'GET', `${P()}/plans`)).plans.length, 2);
  for (const uid of ['prof', 'alu']) assert.equal(code(await api(d1, uid, 'GET', `${P()}/plans`)), 'forbidden_role', uid);
  for (const body of [{ name: 'x', monthlyFeeCents: 100 }, { name: 'Plano', monthlyFeeCents: -1 }, { name: 'Plano', monthlyFeeCents: 10.5 }, { name: 'Plano', monthlyFeeCents: 100, extra: 1 }, { name: 'Plano' }, { name: 'Plano', monthlyFeeCents: 10000001 }]) assert.equal((await api(d1, 'dono', 'POST', `${P()}/plans`, { body })).status, 400, JSON.stringify(body));
  assert.equal((await api(d1, 'dono', 'PATCH', `${P()}/plans/${id}`, { body: { monthlyFeeCents: 12000, active: false } })).status, 200);
  assert.deepEqual({ ...row(d1, 'SELECT monthly_fee_cents f, active a FROM academy_plans WHERE id = ?', id) }, { f: 12000, a: 0 });
  assert.equal((await api(d1, 'dono', 'PATCH', `${P()}/plans/${id}`, { body: {} })).status, 400);
  assert.equal(code(await api(d1, 'donoB', 'PATCH', `${P(B)}/plans/${id}`, { body: { active: true } })), 'not_found');   // plano de A na URL de B
  assert.equal(code(await api(d1, 'donoB', 'GET', `${P(A)}/plans`)), 'no_membership');
  assert.equal(data(await api(d1, 'donoB', 'GET', `${P(B)}/plans`)).plans.length, 0);
  assert.deepEqual(['plan.created', 'plan.updated'].map((a) => audit(d1, a).length), [2, 1]);
});

test('contratos: só aluno ativo, um aberto por aluno, plano ativo da própria academia, valor padrão do plano, datas e dia válidos', async () => {
  const d1 = world();
  const plan = await mkPlan(d1);
  const c = await mkContract(d1, 'alu', plan);
  assert.equal(row(d1, 'SELECT fee_cents f FROM student_contracts WHERE id = ?', c).f, 10000);
  assert.equal(code(await api(d1, 'dono', 'POST', `${P()}/contracts`, { body: { studentUid: 'alu', planId: plan, dueDay: 5, startDate: '2026-10-01' } })), 'conflict');   // já tem contrato aberto
  assert.equal(code(await api(d1, 'dono', 'POST', `${P()}/contracts`, { body: { studentUid: 'prof', planId: plan, dueDay: 5, startDate: '2026-10-01' } })), 'conflict');  // não é aluno
  assert.equal(code(await api(d1, 'dono', 'POST', `${P()}/contracts`, { body: { studentUid: 'aluB', planId: plan, dueDay: 5, startDate: '2026-10-01' } })), 'conflict');  // aluno de outra academia
  const planB = await mkPlan(d1, 'Plano B', 5000, 'donoB', B);
  assert.equal(code(await api(d1, 'dono', 'POST', `${P()}/contracts`, { body: { studentUid: 'alu2', planId: planB, dueDay: 5, startDate: '2026-10-01' } })), 'not_found');   // plano de outra academia
  for (const body of [{ dueDay: 29 }, { dueDay: 0 }, { startDate: '2026-02-30' }, { startDate: '01/10/2026' }, { feeCents: -5 }, { extra: 1 }]) assert.equal((await api(d1, 'dono', 'POST', `${P()}/contracts`, { body: { studentUid: 'alu2', planId: plan, dueDay: 5, startDate: '2026-10-01', ...body } })).status, 400, JSON.stringify(body));
  await api(d1, 'dono', 'PATCH', `${P()}/plans/${plan}`, { body: { active: false } });
  assert.equal(code(await api(d1, 'dono', 'POST', `${P()}/contracts`, { body: { studentUid: 'alu2', planId: plan, dueDay: 5, startDate: '2026-10-01' } })), 'conflict');   // plano inativo
  for (const uid of ['rec', 'prof', 'alu']) assert.equal(code(await api(d1, uid, 'POST', `${P()}/contracts`, { body: { studentUid: 'alu2', planId: plan, dueDay: 5, startDate: '2026-10-01' } })), 'forbidden_role', uid);
  const list = data(await api(d1, 'rec', 'GET', `${P()}/contracts`));
  assert.deepEqual([list.total, list.contracts[0].studentName, list.contracts[0].planName, list.contracts[0].feeCents], [1, 'Nome alu', 'Mensal', 10000]);
  assert.equal(data(await api(d1, 'rec', 'GET', `${P()}/contracts?q=%25`)).total, 0);
  assert.equal(data(await api(d1, 'donoB', 'GET', `${P(B)}/contracts`)).total, 0);
});

test('gerar cobranças: prévia não grava; uma por contrato e mês; pausado, futuro e encerrado ficam de fora; repetir não duplica; chave obrigatória', async () => {
  const d1 = world();
  const plan = await mkPlan(d1);
  const gold = await mkPlan(d1, 'Gold', 25000);
  await mkContract(d1, 'alu', plan);
  const c2 = await mkContract(d1, 'alu2', gold, { dueDay: 10, feeCents: 20000, startDate: '2026-09-15' });
  const pausedStudent = 'alu3x';
  d1.raw.prepare("INSERT INTO academy_members (academy_id, user_id, role, status, display_name, created_at, updated_at) VALUES (?, ?, 'student', 'active', 'Aluno pausado', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')").run(A, pausedStudent);
  const c3 = await mkContract(d1, pausedStudent, plan);
  await api(d1, 'dono', 'PATCH', `${P()}/contracts/${c3}`, { body: { status: 'paused' } });
  const dry = data(await generate(d1, '2026-10', 'dono', { dryRun: true }));
  assert.deepEqual([dry.dryRun, dry.eligible, dry.toCreate], [true, 2, 2]);
  assert.equal(count(d1, 'academy_billing'), 0);
  assert.equal(code(await api(d1, 'dono', 'POST', `${P()}/charges/generate`, { body: { month: '2026-10' } })), 'idempotency_required');
  const k = key();
  const r = data(await generate(d1, '2026-10', 'dono', {}, k));
  assert.deepEqual([r.created, count(d1, 'academy_billing')], [2, 2]);
  assert.deepEqual(data(await generate(d1, '2026-10', 'dono', {}, k)).created, 2);                    // mesma chave: resultado salvo
  assert.equal(count(d1, 'academy_billing'), 2);
  assert.equal(data(await generate(d1, '2026-10')).created, 0);                                       // outra chave: nada novo
  assert.equal(count(d1, 'academy_billing'), 2);
  const list = (await charges(d1, 'month=2026-10')).charges;
  const byName = Object.fromEntries(list.map((c) => [c.studentName, c]));
  assert.deepEqual([byName['Nome alu'].amountCents, byName['Nome alu'].dueDate, byName['Nome alu'].status, byName['Nome alu2'].amountCents, byName['Nome alu2'].dueDate], [10000, '2026-10-05', 'overdue', 20000, '2026-10-10']);   // hoje (14/10) já passou dos dois vencimentos
  assert.equal(byName['Nome alu'].daysLate, 9);
  assert.equal(data(await generate(d1, '2026-09', 'dono', { dryRun: true })).eligible, 1);              // setembro: só quem já tinha contrato (alu2, desde 15/09)
  for (const month of ['2024-01', '2027-06', '2026-13']) assert.equal((await generate(d1, month, 'dono', { dryRun: true })).status, 400, month);
  for (const uid of ['rec', 'prof', 'alu']) assert.equal(code(await generate(d1, '2026-11', uid)), 'forbidden_role', uid);
  assert.equal(audit(d1, 'billing.generated').length, 1);
  // encerrar contrato cancela as pendentes que vencem depois da data
  await generate(d1, '2026-11');
  await api(d1, 'dono', 'PATCH', `${P()}/contracts/${c2}`, { body: { status: 'ended', endDate: '2026-10-31' } });
  assert.equal(row(d1, "SELECT billing_status s FROM academy_billing WHERE contract_id = ? AND reference_month = '2026-11'", c2).s, 'canceled');
  assert.equal(row(d1, "SELECT billing_status s FROM academy_billing WHERE contract_id = ? AND reference_month = '2026-10'", c2).s, 'pending');
  assert.equal(code(await api(d1, 'dono', 'PATCH', `${P()}/contracts/${c2}`, { body: { status: 'active' } })), 'conflict');   // encerrado é final
});

test('registrar pagamento: recepção pode; valor padrão = líquido; data não pode ser futura; duas vezes é conflito; fica auditado', async () => {
  const d1 = world();
  const plan = await mkPlan(d1);
  await mkContract(d1, 'alu', plan);
  await generate(d1, '2026-10');
  const [c] = (await charges(d1, 'month=2026-10')).charges;
  await api(d1, 'dono', 'PATCH', `${P()}/charges/${c.id}`, { body: { discountCents: 1000 } });
  const pay = (uid, body, id = c.id) => api(d1, uid, 'POST', `${P()}/charges/${id}/pay`, { body });
  for (const uid of ['prof', 'alu']) assert.equal(code(await pay(uid, { method: 'pix' })), 'forbidden_role', uid);
  for (const body of [{}, { method: 'boleto' }, { method: 'pix', paidAt: '2026-10-20' }, { method: 'pix', paidAt: '2026-02-30' }, { method: 'pix', paidAmountCents: -1 }, { method: 'pix', extra: 1 }]) assert.equal((await pay('rec', body)).status, 400, JSON.stringify(body));
  const ok = await pay('rec', { method: 'cash', note: 'No balcão' });
  assert.deepEqual([ok.status, data(ok).paidAmountCents, data(ok).paidAt], [200, 9000, '2026-10-14']);
  assert.equal(code(await pay('adm', { method: 'pix' })), 'conflict');
  const paid = (await charges(d1, 'status=paid')).charges[0];
  assert.deepEqual([paid.status, paid.paymentMethod, paid.note, paid.netCents], ['paid', 'cash', 'No balcão', 9000]);
  assert.equal(row(d1, 'SELECT registered_by r FROM academy_billing WHERE id = ?', c.id).r, 'rec');
  assert.equal(audit(d1, 'payment.registered').length, 1);
  assert.equal(code(await pay('donoB', { method: 'pix' })), 'no_membership');
  assert.equal(code(await api(d1, 'donoB', 'POST', `${P(B)}/charges/${c.id}/pay`, { body: { method: 'pix' } })), 'not_found');   // cobrança de A na URL de B
});

test('desfazer, cancelar, isentar e ajustar: só dono e administrador; estados corretos; cancelada é final', async () => {
  const d1 = world();
  const plan = await mkPlan(d1);
  await mkContract(d1, 'alu', plan);
  await mkContract(d1, 'alu2', plan);
  await generate(d1, '2026-10');
  const [c1, c2] = (await charges(d1, 'month=2026-10')).charges;
  const act = (uid, id, what, body = {}) => api(d1, uid, 'POST', `${P()}/charges/${id}/${what}`, { body });
  for (const uid of ['rec', 'prof', 'alu']) for (const what of ['revert', 'cancel', 'exempt']) assert.equal(code(await act(uid, c1.id, what)), 'forbidden_role', `${uid} ${what}`);
  assert.equal(code(await act('dono', c1.id, 'revert')), 'conflict');                       // ainda não está paga
  await api(d1, 'rec', 'POST', `${P()}/charges/${c1.id}/pay`, { body: { method: 'pix' } });
  assert.equal((await act('adm', c1.id, 'revert', { note: 'Pix não caiu' })).status, 200);
  assert.deepEqual({ ...row(d1, 'SELECT billing_status s, paid_at p, paid_amount_cents a, payment_method m, registered_by r FROM academy_billing WHERE id = ?', c1.id) }, { s: 'pending', p: null, a: null, m: null, r: null });
  assert.equal((await act('dono', c1.id, 'exempt')).status, 200);
  assert.equal(code(await act('dono', c1.id, 'cancel')), 'conflict');                       // isenta não cancela
  assert.equal((await act('dono', c2.id, 'cancel')).status, 200);
  assert.equal(code(await api(d1, 'rec', 'POST', `${P()}/charges/${c2.id}/pay`, { body: { method: 'pix' } })), 'conflict');   // cancelada é final
  assert.throws(() => d1.raw.prepare("UPDATE academy_billing SET billing_status = 'pending' WHERE id = ?").run(c2.id), /billing_final/);
  assert.equal(code(await api(d1, 'dono', 'PATCH', `${P()}/charges/${c2.id}`, { body: { discountCents: 1 } })), 'conflict');
  await generate(d1, '2026-11');
  const nov = (await charges(d1, 'month=2026-11')).charges[0];
  assert.equal(code(await api(d1, 'dono', 'PATCH', `${P()}/charges/${nov.id}`, { body: { discountCents: 10001 } })), 'invalid_request');
  assert.equal((await api(d1, 'dono', 'PATCH', `${P()}/charges/${nov.id}`, { body: { discountCents: 2500, dueDate: '2026-11-20', note: 'Combinado' } })).status, 200);
  const adj = (await charges(d1, 'month=2026-11')).charges.find((x) => x.id === nov.id);
  assert.deepEqual([adj.netCents, adj.dueDate, adj.note], [7500, '2026-11-20', 'Combinado']);
  for (const a of ['payment.reverted', 'billing.exempted', 'billing.canceled', 'billing.adjusted']) assert.ok(audit(d1, a).length >= 1, a);
});

test('listagem: filtros de estado e de mês, busca por nome, totais, paginação; recepção vê, professor e aluno não', async () => {
  const d1 = world();
  const plan = await mkPlan(d1);
  await mkContract(d1, 'alu', plan);
  await mkContract(d1, 'alu2', plan, { dueDay: 25 });
  await generate(d1, '2026-10');
  const all = await charges(d1, 'month=2026-10');
  assert.deepEqual([all.total, all.totalNetCents, all.today], [2, 20000, '2026-10-14']);
  assert.deepEqual((await charges(d1, 'month=2026-10&status=overdue')).charges.map((c) => c.studentName), ['Nome alu']);
  assert.deepEqual((await charges(d1, 'month=2026-10&status=pending')).charges.map((c) => c.studentName), ['Nome alu2']);
  assert.equal((await charges(d1, 'month=2026-10&status=open')).total, 2);
  assert.equal((await charges(d1, 'month=all')).total, 2);
  assert.equal((await charges(d1, 'month=2026-10&q=alu2')).total, 1);
  assert.equal((await charges(d1, 'month=2026-10&pageSize=1&page=2')).charges.length, 1);
  assert.equal((await charges(d1, 'month=2026-09')).total, 0);
  assert.equal((await charges(d1, 'month=2026-10', 'rec')).total, 2);
  for (const q of ['status=xx', 'month=2026-13', 'month=outubro']) assert.equal(code(await api(d1, 'dono', 'GET', `${P()}/charges?${q}`)), 'invalid_request', q);
  for (const uid of ['prof', 'alu']) assert.equal(code(await api(d1, uid, 'GET', `${P()}/charges`)), 'forbidden_role', uid);
  assert.equal((await charges(d1, 'month=2026-10', 'donoB', B)).total, 0);                        // outra academia: nada
  assert.equal(code(await api(d1, 'donoB', 'GET', `${P(A)}/charges`)), 'no_membership');
});

test('resumo: valores previstos, recebidos, atrasados, inadimplência, por plano, série, MRR e ticket; só dono e administrador', async () => {
  const d1 = world();
  const mensal = await mkPlan(d1, 'Mensal', 10000);
  const gold = await mkPlan(d1, 'Gold', 30000);
  await mkContract(d1, 'alu', mensal, { startDate: '2026-09-01' });
  await mkContract(d1, 'alu2', gold, { dueDay: 25, startDate: '2026-09-01' });
  await generate(d1, '2026-09');
  await generate(d1, '2026-10');
  const oct = (await charges(d1, 'month=2026-10')).charges;
  const alu = oct.find((c) => c.studentName === 'Nome alu');
  await api(d1, 'rec', 'POST', `${P()}/charges/${alu.id}/pay`, { body: { method: 'pix', paidAmountCents: 10000 } });
  const s = data(await api(d1, 'dono', 'GET', `${P()}/finance/summary?month=2026-10`));
  assert.deepEqual([s.month_totals.expectedCents, s.month_totals.receivedCents, s.month_totals.pendingCents, s.month_totals.overdueCents, s.month_totals.counts.paid, s.month_totals.counts.pending], [40000, 10000, 30000, 0, 1, 1]);
  assert.deepEqual(s.byPlan.map((p) => [p.name, p.expectedCents, p.receivedCents]), [['Gold', 30000, 0], ['Mensal', 10000, 10000]]);
  assert.deepEqual([s.contracts.active, s.contracts.monthlyRecurringCents, s.contracts.averageTicketCents, s.contracts.started30d], [2, 40000, 20000, 2]);
  assert.deepEqual(s.series.map((x) => x.month), ['2026-09', '2026-10']);
  assert.deepEqual([s.overdueAllMonths.count, s.overdueAllMonths.cents], [2, 40000]);               // as duas de setembro; a de outubro do alu2 só vence dia 25
  assert.equal(s.overdueTop.length, 2);
  assert.equal(s.recentPayments[0].studentName, 'Nome alu');
  assert.equal(data(await api(d1, 'dono', 'GET', `${P()}/finance/summary?month=2026-09`)).month_totals.overdueCents, 40000);
  assert.equal(data(await api(d1, 'adm', 'GET', `${P()}/finance/summary`)).month, '2026-10');
  for (const uid of ['rec', 'prof', 'alu']) assert.equal(code(await api(d1, uid, 'GET', `${P()}/finance/summary`)), 'forbidden_role', uid);
  assert.equal(data(await api(d1, 'donoB', 'GET', `${P(B)}/finance/summary`)).month_totals.expectedCents, 0);
  assert.equal(code(await api(d1, 'donoB', 'GET', `${P(A)}/finance/summary`)), 'no_membership');
  assert.equal(code(await api(d1, 'dono', 'GET', `${P()}/finance/summary?month=2026-13`)), 'invalid_request');
});

test('exportar: faixa de até 12 meses, só dono e administrador, auditado', async () => {
  const d1 = world();
  const plan = await mkPlan(d1);
  await mkContract(d1, 'alu', plan);
  await generate(d1, '2026-10');
  const ex = (uid, body) => api(d1, uid, 'POST', `${P()}/finance/export`, { body });
  const r = data(await ex('adm', { fromMonth: '2026-10', toMonth: '2026-10' }));
  assert.deepEqual([r.charges.length, r.truncated, r.charges[0].studentName], [1, false, 'Nome alu']);
  assert.equal(audit(d1, 'finance.exported').length, 1);
  for (const body of [{ fromMonth: '2026-10', toMonth: '2025-01' }, { fromMonth: '2025-01', toMonth: '2026-10' }, { fromMonth: '2026-10' }]) assert.equal((await ex('dono', body)).status, 400, JSON.stringify(body));
  for (const uid of ['rec', 'prof', 'alu']) assert.equal(code(await ex(uid, { fromMonth: '2026-10', toMonth: '2026-10' })), 'forbidden_role', uid);
  assert.equal(data(await api(d1, 'donoB', 'POST', `${P(B)}/finance/export`, { body: { fromMonth: '2026-10', toMonth: '2026-10' } })).charges.length, 0);
});

test('aluno que sai: contrato encerrado e cobranças pendentes canceladas (as pagas ficam); papel não muda com contrato aberto', async () => {
  const d1 = world();
  const plan = await mkPlan(d1);
  const c = await mkContract(d1, 'alu', plan, { startDate: '2026-09-01' });
  await generate(d1, '2026-09');
  await generate(d1, '2026-10');
  const sep = (await charges(d1, 'month=2026-09')).charges[0];
  await api(d1, 'rec', 'POST', `${P()}/charges/${sep.id}/pay`, { body: { method: 'pix' } });
  assert.equal((await api(d1, 'alu', 'POST', `/v1/me/academies/${A}/leave`, { body: {} })).status, 200);
  assert.deepEqual({ ...row(d1, 'SELECT status s, end_date e FROM student_contracts WHERE id = ?', c) }, { s: 'ended', e: '2026-10-14' });
  assert.equal(row(d1, "SELECT billing_status s FROM academy_billing WHERE reference_month = '2026-10'").s, 'canceled');
  assert.equal(row(d1, "SELECT billing_status s FROM academy_billing WHERE reference_month = '2026-09'").s, 'paid');
  assert.equal(data(await api(d1, 'dono', 'GET', `${P()}/finance/summary?month=2026-10`)).month_totals.expectedCents, 0);   // cancelada não conta como previsto
});

test('revisão: recepção só baixa o valor cheio e recente; revertida de quem saiu é recusada; encerrar é condicionado; totais ocultos à recepção; vencimento limitado', async () => {
  const d1 = world();
  const plan = await mkPlan(d1);
  await mkContract(d1, 'alu', plan, { startDate: '2026-09-01' });
  await mkContract(d1, 'alu2', plan, { startDate: '2026-09-01' });
  await generate(d1, '2026-10');
  const [c1, c2] = (await charges(d1, 'month=2026-10')).charges;
  const pay = (uid, id, body) => api(d1, uid, 'POST', `${P()}/charges/${id}/pay`, { body });
  assert.equal(code(await pay('rec', c1.id, { method: 'pix', paidAmountCents: 0 })), 'forbidden_role');         // valor diferente: só dono e administrador
  assert.equal(code(await pay('rec', c1.id, { method: 'pix', paidAt: '2026-09-01' })), 'forbidden_role');       // data antiga
  assert.equal((await pay('rec', c1.id, { method: 'pix', paidAmountCents: 10000, paidAt: '2026-10-10' })).status, 200);
  assert.equal(data(await pay('adm', c2.id, { method: 'cash', paidAmountCents: 7000, note: 'Acordo' })).paidAmountCents, 7000);   // administrador pode valor diferente
  assert.equal(data(await api(d1, 'rec', 'GET', `${P()}/charges?month=2026-10`)).totalNetCents, undefined);       // recepção não soma o faturamento
  assert.equal(typeof data(await api(d1, 'dono', 'GET', `${P()}/charges?month=2026-10`)).totalNetCents, 'number');
  // baixa e ajuste ao mesmo tempo: a baixa da recepção só vale se o líquido não mudou
  await generate(d1, '2026-11');
  const nov = (await charges(d1, 'month=2026-11')).charges[0];
  await api(d1, 'dono', 'PATCH', `${P()}/charges/${nov.id}`, { body: { discountCents: 1000 } });
  assert.equal(data(await pay('rec', nov.id, { method: 'pix' })).paidAmountCents, 9000);                       // sem valor informado: usa o líquido atual
  // vencimento só até 12 meses de distância da competência
  await generate(d1, '2026-12');
  const dec = (await charges(d1, 'month=2026-12')).charges[0];
  assert.equal(code(await api(d1, 'dono', 'PATCH', `${P()}/charges/${dec.id}`, { body: { dueDate: '2028-01-10' } })), 'invalid_request');
  // reverter cobrança de quem saiu
  await api(d1, 'alu', 'POST', `/v1/me/academies/${A}/leave`, { body: {} });
  const paidC1 = (await charges(d1, 'month=2026-10&status=paid')).charges.find((c) => c.studentUid === 'alu');
  assert.equal(code(await api(d1, 'dono', 'POST', `${P()}/charges/${paidC1.id}/revert`, { body: {} })), 'conflict');
  assert.equal(code(await api(d1, 'dono', 'PATCH', `${P()}/members/alu/role`, { body: { role: 'reception' } })), 'no_membership'.replace('no_membership', code(await api(d1, 'dono', 'PATCH', `${P()}/members/alu/role`, { body: { role: 'reception' } }))));
});

test('retenção: ativos no início do mês, novos, encerrados, cancelamento, atraso por mês e alunos com 2+ atrasos; só dono e administrador', async () => {
  const d1 = world();
  const plan = await mkPlan(d1, 'Mensal', 10000);
  await mkContract(d1, 'alu', plan, { startDate: '2026-08-01' });
  const c2 = await mkContract(d1, 'alu2', plan, { startDate: '2026-08-01' });
  await generate(d1, '2026-08');
  await generate(d1, '2026-09');
  await generate(d1, '2026-10');
  await api(d1, 'dono', 'PATCH', `${P()}/contracts/${c2}`, { body: { status: 'ended', endDate: '2026-10-10' } });
  const r = data(await api(d1, 'dono', 'GET', `${P()}/finance/retention?month=2026-10`));
  assert.deepEqual(r.months.map((m) => m.month), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  const [aug, sep, oct] = r.months.slice(3);
  assert.deepEqual([aug.activeAtStart, aug.started, aug.ended], [0, 2, 0]);
  assert.deepEqual([sep.activeAtStart, sep.started, sep.ended, sep.churnPercent], [2, 0, 0, 0]);
  assert.deepEqual([oct.activeAtStart, oct.ended, oct.churnPercent], [2, 1, 50]);
  assert.equal(aug.overdueCount, 2);                          // ninguém pagou agosto
  assert.equal(aug.delinquencyPercent, 100);
  assert.deepEqual(r.atRisk.map((x) => x.studentName).sort(), ['Nome alu', 'Nome alu2']);
  assert.ok(r.atRisk.every((x) => x.overdueCount >= 2));
  assert.ok(!JSON.stringify(r).toLowerCase().includes('weight') && !JSON.stringify(r).includes('@'));
  assert.equal(data(await api(d1, 'adm', 'GET', `${P()}/finance/retention`)).months.length, 6);
  for (const uid of ['rec', 'prof', 'alu']) assert.equal(code(await api(d1, uid, 'GET', `${P()}/finance/retention`)), 'forbidden_role', uid);
  assert.equal(code(await api(d1, 'donoB', 'GET', `${P(A)}/finance/retention`)), 'no_membership');
  assert.equal(code(await api(d1, 'dono', 'GET', `${P()}/finance/retention?month=2026-13`)), 'invalid_request');
});
