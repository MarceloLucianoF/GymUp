import { PAYMENT_METHODS, SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { ApiError, enumParam, intParam, readBody } from '../http.js';
import { auditStmt, changed, guarded } from '../db.js';
import { requireAccess } from '../authz.js';
import { likeEscape, runIdempotent } from './common.js';

// Financeiro da academia, sem gateway: planos, contratos dos alunos e cobranças mensais com baixa manual.
// Dinheiro sempre em centavos inteiros. Datas de vencimento em AAAA-MM-DD; "hoje" é o dia de Brasília (UTC-3).
// Dono e administrador fazem tudo; a recepção lista cobranças e registra pagamento; professor e aluno não entram.
const STAFF = ['owner', 'admin'];
const FRONT = ['owner', 'admin', 'reception'];
const BRT_MS = 3 * 3600 * 1000;
export const todayBrt = (now) => new Date(now - BRT_MS).toISOString().slice(0, 10);
export const monthOf = (date) => date.slice(0, 7);
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const addMonths = (month, n) => { const [y, m] = month.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`; };
const net = (c) => c.amount_cents - c.discount_cents;
const money = (cents) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

const all = (ctx, sql, ...args) => guarded(async () => (await ctx.db.prepare(sql).bind(...args).all()).results);
const first = (ctx, sql, ...args) => guarded(() => ctx.db.prepare(sql).bind(...args).first());
const view = (c, today) => ({
  id: c.id, studentUid: c.student_uid, studentName: c.student_name ?? '', planName: c.plan_name ?? '', referenceMonth: c.reference_month, description: c.description,
  amountCents: c.amount_cents, discountCents: c.discount_cents, netCents: net(c), dueDate: c.due_date,
  status: c.billing_status === 'pending' && c.due_date < today ? 'overdue' : c.billing_status,
  daysLate: c.billing_status === 'pending' && c.due_date < today ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${c.due_date}T00:00:00Z`)) / 86400000) : 0,
  paidAt: c.paid_at, paidAmountCents: c.paid_amount_cents, paymentMethod: c.payment_method, note: c.note
});

// ---------- planos ----------
export async function listPlans(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, FRONT);
  const rows = await all(ctx, `SELECT p.id, p.name, p.description, p.monthly_fee_cents, p.active, p.updated_at,
      (SELECT count(*) FROM student_contracts c WHERE c.academy_id = p.academy_id AND c.plan_id = p.id AND c.status IN ('active', 'paused')) AS contracts
      FROM academy_plans p WHERE p.academy_id = ? ORDER BY p.active DESC, p.name COLLATE NOCASE LIMIT 100`, academyId);
  return { academyId, plans: rows.map((p) => ({ planId: p.id, name: p.name, description: p.description, monthlyFeeCents: p.monthly_fee_cents, active: p.active === 1, openContracts: p.contracts, updatedAt: p.updated_at })) };
}

export async function createPlan(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const body = await readBody(ctx.request, SCHEMAS.createPlan);
  const n = await first(ctx, 'SELECT count(*) AS n FROM academy_plans WHERE academy_id = ?', academyId);
  if (n.n >= 50) throw new ApiError('limit_reached');
  const id = ctx.newId(24);
  await guarded(() => ctx.db.batch([
    ctx.db.prepare('INSERT INTO academy_plans (id, academy_id, name, description, monthly_fee_cents, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)').bind(id, academyId, body.name, body.description || '', body.monthlyFeeCents, ctx.nowIso, ctx.nowIso),
    auditStmt(ctx.db, ctx, { academyId, action: 'plan.created', targetType: 'plan', targetId: id, detail: money(body.monthlyFeeCents) })
  ]));
  return { planId: id };
}

export async function updatePlan(ctx) {
  const { academyId, id } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const body = await readBody(ctx.request, SCHEMAS.updatePlan);
  const cur = await first(ctx, 'SELECT id FROM academy_plans WHERE id = ? AND academy_id = ?', id, academyId);
  if (!cur) throw new ApiError('not_found');
  const map = { name: 'name', description: 'description', monthlyFeeCents: 'monthly_fee_cents', active: 'active' };
  const sets = Object.keys(body).map((k) => `${map[k]} = ?`);
  const values = Object.entries(body).map(([k, v]) => (k === 'active' ? (v ? 1 : 0) : v));
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare(`UPDATE academy_plans SET ${sets.join(', ')}, updated_at = ? WHERE id = ? AND academy_id = ?`).bind(...values, ctx.nowIso, id, academyId),
    auditStmt(ctx.db, ctx, { academyId, action: 'plan.updated', targetType: 'plan', targetId: id, detail: Object.keys(body).join(',') }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');
  return { planId: id, updated: Object.keys(body) };   // o valor do plano não muda contratos já combinados nem cobranças já geradas
}

// ---------- contratos (matrícula do aluno em um plano) ----------
export async function listContracts(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, FRONT);
  const status = enumParam(ctx.url, 'status', ['active', 'paused', 'ended']);
  const q = (ctx.url.searchParams.get('q') || '').trim().slice(0, 60);
  const pageSize = intParam(ctx.url, 'pageSize', 25, 1, 50);
  const page = intParam(ctx.url, 'page', 1, 1, 1000);
  const where = ['c.academy_id = ?']; const params = [academyId];
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (q) { where.push("lower(m.display_name) LIKE ? ESCAPE '\\'"); params.push(`%${likeEscape(q.toLowerCase())}%`); }
  const W = where.join(' AND ');
  const total = (await first(ctx, `SELECT count(*) AS n FROM student_contracts c JOIN academy_members m ON m.academy_id = c.academy_id AND m.user_id = c.student_uid WHERE ${W}`, ...params)).n;
  const rows = await all(ctx, `SELECT c.id, c.student_uid, m.display_name, c.plan_id, p.name AS plan_name, c.fee_cents, c.due_day, c.start_date, c.end_date, c.status
      FROM student_contracts c JOIN academy_members m ON m.academy_id = c.academy_id AND m.user_id = c.student_uid JOIN academy_plans p ON p.id = c.plan_id AND p.academy_id = c.academy_id
      WHERE ${W} ORDER BY c.status, m.display_name COLLATE NOCASE LIMIT ? OFFSET ?`, ...params, pageSize, (page - 1) * pageSize);
  return { academyId, page, pageSize, total, contracts: rows.map((c) => ({ contractId: c.id, studentUid: c.student_uid, studentName: c.display_name, planId: c.plan_id, planName: c.plan_name, feeCents: c.fee_cents, dueDay: c.due_day, startDate: c.start_date, endDate: c.end_date, status: c.status })) };
}

export async function createContract(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const body = await readBody(ctx.request, SCHEMAS.createContract);
  if (!validDate(body.startDate)) throw new ApiError('invalid_request');
  const plan = await first(ctx, 'SELECT id, monthly_fee_cents, active FROM academy_plans WHERE id = ? AND academy_id = ?', body.planId, academyId);
  if (!plan) throw new ApiError('not_found');
  if (plan.active !== 1) throw new ApiError('conflict');
  const id = ctx.newId(24);
  await guarded(() => ctx.db.batch([
    ctx.db.prepare('INSERT INTO student_contracts (id, academy_id, student_uid, plan_id, fee_cents, due_day, start_date, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, \'active\', ?, ?, ?)')
      .bind(id, academyId, body.studentUid, body.planId, body.feeCents ?? plan.monthly_fee_cents, body.dueDay, body.startDate, ctx.user.uid, ctx.nowIso, ctx.nowIso),   // aluno inativo ou que já tem contrato aberto: o banco recusa
    auditStmt(ctx.db, ctx, { academyId, action: 'contract.created', targetType: 'contract', targetId: id, detail: `aluno ${body.studentUid.slice(0, 8)}` })
  ]));
  return { contractId: id };
}

export async function updateContract(ctx) {
  const { academyId, id } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const body = await readBody(ctx.request, SCHEMAS.updateContract);
  const cur = await first(ctx, 'SELECT id, status, start_date FROM student_contracts WHERE id = ? AND academy_id = ?', id, academyId);
  if (!cur) throw new ApiError('not_found');
  if (cur.status === 'ended') throw new ApiError('conflict');
  const today = todayBrt(ctx.now);
  if (body.endDate !== undefined && !validDate(body.endDate)) throw new ApiError('invalid_request');
  if (body.planId !== undefined) {
    const plan = await first(ctx, 'SELECT active FROM academy_plans WHERE id = ? AND academy_id = ?', body.planId, academyId);
    if (!plan) throw new ApiError('not_found');
    if (plan.active !== 1) throw new ApiError('conflict');
  }
  const ending = body.status === 'ended';
  const endDate = ending ? (body.endDate ?? today) : null;
  if (ending && endDate < cur.start_date) throw new ApiError('invalid_request');
  if (!ending && body.endDate !== undefined) throw new ApiError('invalid_request');
  const map = { planId: 'plan_id', feeCents: 'fee_cents', dueDay: 'due_day', status: 'status' };
  const sets = Object.keys(body).filter((k) => map[k]).map((k) => `${map[k]} = ?`);
  const values = Object.keys(body).filter((k) => map[k]).map((k) => body[k]);
  if (ending) { sets.push('end_date = ?'); values.push(endDate); }
  const stmts = [
    ctx.db.prepare(`UPDATE student_contracts SET ${sets.join(', ')}, updated_at = ? WHERE id = ? AND academy_id = ? AND status <> 'ended'`).bind(...values, ctx.nowIso, id, academyId),
    auditStmt(ctx.db, ctx, { academyId, action: 'contract.updated', targetType: 'contract', targetId: id, detail: Object.keys(body).join(',') }, true)
  ];
  // Encerrar: cobranças pendentes que vencem depois do último dia deixam de valer (as vencidas e as pagas permanecem).
  if (ending) stmts.push(ctx.db.prepare("UPDATE academy_billing SET billing_status = 'canceled', updated_at = ? WHERE contract_id = ? AND academy_id = ? AND billing_status = 'pending' AND due_date > ?").bind(ctx.nowIso, id, academyId, endDate));
  const results = await guarded(() => ctx.db.batch(stmts));
  if (!changed(results)) throw new ApiError('conflict');
  return { contractId: id, updated: Object.keys(body) };
}

// ---------- cobranças ----------
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthParam = (ctx, name, fallback) => {
  const v = ctx.url.searchParams.get(name) || fallback;
  if (!MONTH_RE.test(v)) throw new ApiError('invalid_request');
  return v;
};
const FILTERS = ['open', 'pending', 'overdue', 'paid', 'exempt', 'canceled'];

export async function listCharges(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, FRONT);
  const today = todayBrt(ctx.now);
  const month = ctx.url.searchParams.get('month') === 'all' ? null : monthParam(ctx, 'month', monthOf(today));
  const status = enumParam(ctx.url, 'status', FILTERS);
  const q = (ctx.url.searchParams.get('q') || '').trim().slice(0, 60);
  const pageSize = intParam(ctx.url, 'pageSize', 25, 1, 50);
  const page = intParam(ctx.url, 'page', 1, 1, 1000);
  const where = ['b.academy_id = ?']; const params = [academyId];
  if (month) { where.push('b.reference_month = ?'); params.push(month); }
  if (status === 'overdue') { where.push("b.billing_status = 'pending' AND b.due_date < ?"); params.push(today); }
  else if (status === 'open') where.push("b.billing_status = 'pending'");
  else if (status === 'pending') { where.push("b.billing_status = 'pending' AND b.due_date >= ?"); params.push(today); }
  else if (status) { where.push('b.billing_status = ?'); params.push(status); }
  if (q) { where.push("lower(m.display_name) LIKE ? ESCAPE '\\'"); params.push(`%${likeEscape(q.toLowerCase())}%`); }
  const W = where.join(' AND ');
  const base = `FROM academy_billing b JOIN academy_members m ON m.academy_id = b.academy_id AND m.user_id = b.student_uid WHERE ${W}`;
  const totals = await first(ctx, `SELECT count(*) AS n, COALESCE(sum(b.amount_cents - b.discount_cents), 0) AS net ${base}`, ...params);
  const rows = await all(ctx, `SELECT b.*, m.display_name AS student_name, (SELECT name FROM academy_plans p WHERE p.id = b.plan_id AND p.academy_id = b.academy_id) AS plan_name ${base} ORDER BY b.due_date, m.display_name COLLATE NOCASE LIMIT ? OFFSET ?`, ...params, pageSize, (page - 1) * pageSize);
  return { academyId, today, month, page, pageSize, total: totals.n, totalNetCents: totals.net, charges: rows.map((r) => view(r, today)) };
}

// Gera as cobranças do mês para todos os contratos ativos (uma por contrato e mês; repetir não duplica). dryRun só conta.
export async function generateCharges(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const body = await readBody(ctx.request, SCHEMAS.generateCharges);
  const today = todayBrt(ctx.now);
  const month = body.month;
  if (month < addMonths(monthOf(today), -12) || month > addMonths(monthOf(today), 2)) throw new ApiError('invalid_request');
  const eligible = `FROM student_contracts c JOIN academy_members m ON m.academy_id = c.academy_id AND m.user_id = c.student_uid AND m.status = 'active'
      WHERE c.academy_id = ? AND c.status = 'active' AND substr(c.start_date, 1, 7) <= ? AND (c.end_date IS NULL OR substr(c.end_date, 1, 7) >= ?)`;
  const preview = await first(ctx, `SELECT count(*) AS n, COALESCE(sum(c.fee_cents), 0) AS cents,
      COALESCE(sum(CASE WHEN EXISTS (SELECT 1 FROM academy_billing b WHERE b.contract_id = c.id AND b.reference_month = ?) THEN 1 ELSE 0 END), 0) AS existing ${eligible}`, month, academyId, month, month);
  const result = { month, eligible: preview.n, alreadyGenerated: preview.existing, toCreate: preview.n - preview.existing };
  if (body.dryRun === true) return { dryRun: true, ...result };
  return runIdempotent(ctx, `${academyId}|${ctx.user.uid}`, { month }, async () => {
    if (result.toCreate === 0) return { stmts: [], response: { dryRun: false, ...result, created: 0 } };
    const insert = ctx.db.prepare(`INSERT INTO academy_billing (id, academy_id, student_uid, contract_id, plan_id, reference_month, description, amount_cents, discount_cents, due_date, billing_status, created_at, updated_at)
        SELECT lower(hex(randomblob(12))), c.academy_id, c.student_uid, c.id, c.plan_id, ?, (SELECT name FROM academy_plans p WHERE p.id = c.plan_id AND p.academy_id = c.academy_id) || ' ' || ?, c.fee_cents, 0, ? || '-' || printf('%02d', c.due_day), 'pending', ?, ?
        ${eligible} ON CONFLICT (contract_id, reference_month) DO NOTHING`).bind(month, month, month, ctx.nowIso, ctx.nowIso, academyId, month, month);
    return {
      stmts: [insert, auditStmt(ctx.db, ctx, { academyId, action: 'billing.generated', targetType: 'billing', targetId: month, detail: `${result.toCreate} cobranças` })],
      response: { dryRun: false, ...result, created: result.toCreate }
    };
  });
}

async function loadCharge(ctx, academyId, id) {
  const c = await first(ctx, 'SELECT * FROM academy_billing WHERE id = ? AND academy_id = ?', id, academyId);
  if (!c) throw new ApiError('not_found');
  return c;
}

export async function payCharge(ctx) {
  const { academyId, id } = ctx.params;
  await requireAccess(ctx, academyId, FRONT);
  const body = await readBody(ctx.request, SCHEMAS.payCharge);
  const c = await loadCharge(ctx, academyId, id);
  if (c.billing_status !== 'pending') throw new ApiError('conflict');
  const today = todayBrt(ctx.now);
  const paidAt = body.paidAt ?? today;
  if (!validDate(paidAt) || paidAt > today || paidAt < '2000-01-01') throw new ApiError('invalid_request');
  const paid = body.paidAmountCents ?? net(c);
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare("UPDATE academy_billing SET billing_status = 'paid', paid_at = ?, paid_amount_cents = ?, payment_method = ?, note = ?, registered_by = ?, updated_at = ? WHERE id = ? AND academy_id = ? AND billing_status = 'pending'")
      .bind(paidAt, paid, body.method, body.note ?? c.note, ctx.user.uid, ctx.nowIso, id, academyId),
    auditStmt(ctx.db, ctx, { academyId, action: 'payment.registered', targetType: 'billing', targetId: id, detail: `${body.method} ${money(paid)}` }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');   // outra pessoa registrou ao mesmo tempo
  return { chargeId: id, status: 'paid', paidAt, paidAmountCents: paid };
}

// Mudanças de estado só do dono e do administrador: desfazer pagamento, cancelar, isentar e ajustar.
async function transition(ctx, { from, to, action, extraSql = '', extraArgs = [], detail = '' }) {
  const { academyId, id } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const body = await readBody(ctx.request, SCHEMAS.chargeNote);
  const c = await loadCharge(ctx, academyId, id);
  if (c.billing_status !== from) throw new ApiError('conflict');
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare(`UPDATE academy_billing SET billing_status = ?, ${extraSql} note = ?, updated_at = ? WHERE id = ? AND academy_id = ? AND billing_status = ?`).bind(to, ...extraArgs, body.note ?? c.note, ctx.nowIso, id, academyId, from),
    auditStmt(ctx.db, ctx, { academyId, action, targetType: 'billing', targetId: id, detail: detail || (body.note || '').slice(0, 80) }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');
  return { chargeId: id, status: to };
}
export const revertPayment = (ctx) => transition(ctx, { from: 'paid', to: 'pending', action: 'payment.reverted', extraSql: 'paid_at = NULL, paid_amount_cents = NULL, payment_method = NULL, registered_by = NULL,' });
export const cancelCharge = (ctx) => transition(ctx, { from: 'pending', to: 'canceled', action: 'billing.canceled' });
export const exemptCharge = (ctx) => transition(ctx, { from: 'pending', to: 'exempt', action: 'billing.exempted' });

export async function adjustCharge(ctx) {
  const { academyId, id } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const body = await readBody(ctx.request, SCHEMAS.adjustCharge);
  const c = await loadCharge(ctx, academyId, id);
  if (c.billing_status !== 'pending') throw new ApiError('conflict');
  const discount = body.discountCents ?? c.discount_cents;
  if (discount > c.amount_cents) throw new ApiError('invalid_request');
  if (body.dueDate !== undefined && !validDate(body.dueDate)) throw new ApiError('invalid_request');
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare("UPDATE academy_billing SET discount_cents = ?, due_date = ?, note = ?, updated_at = ? WHERE id = ? AND academy_id = ? AND billing_status = 'pending'").bind(discount, body.dueDate ?? c.due_date, body.note ?? c.note, ctx.nowIso, id, academyId),
    auditStmt(ctx.db, ctx, { academyId, action: 'billing.adjusted', targetType: 'billing', targetId: id, detail: `desconto ${money(discount)}${body.dueDate ? `, vence ${body.dueDate}` : ''}` }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');
  return { chargeId: id, discountCents: discount, dueDate: body.dueDate ?? c.due_date };
}

// ---------- resumo financeiro (só dono e administrador) ----------
export async function summary(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const today = todayBrt(ctx.now);
  const month = monthParam(ctx, 'month', monthOf(today));
  const from6 = addMonths(month, -5);
  const live = "b.billing_status IN ('pending', 'paid')";
  const [totals, series, byPlan, contracts, flow, overdueTop] = await Promise.all([
    first(ctx, `SELECT
        COALESCE(sum(CASE WHEN ${live} THEN b.amount_cents - b.discount_cents END), 0) AS expected,
        COALESCE(sum(CASE WHEN b.billing_status = 'paid' THEN b.paid_amount_cents END), 0) AS received,
        COALESCE(sum(CASE WHEN b.billing_status = 'pending' AND b.due_date >= ? THEN b.amount_cents - b.discount_cents END), 0) AS pending_cents,
        COALESCE(sum(CASE WHEN b.billing_status = 'pending' AND b.due_date < ? THEN b.amount_cents - b.discount_cents END), 0) AS overdue_cents,
        COALESCE(sum(CASE WHEN b.billing_status = 'pending' AND b.due_date < ? THEN 1 END), 0) AS overdue_count,
        COALESCE(sum(CASE WHEN b.billing_status = 'pending' AND b.due_date >= ? THEN 1 END), 0) AS pending_count,
        COALESCE(sum(CASE WHEN b.billing_status = 'paid' THEN 1 END), 0) AS paid_count,
        COALESCE(sum(CASE WHEN b.billing_status = 'exempt' THEN 1 END), 0) AS exempt_count
      FROM academy_billing b WHERE b.academy_id = ? AND b.reference_month = ?`, today, today, today, today, academyId, month),
    all(ctx, `SELECT b.reference_month AS month, COALESCE(sum(CASE WHEN ${live} THEN b.amount_cents - b.discount_cents END), 0) AS expected, COALESCE(sum(CASE WHEN b.billing_status = 'paid' THEN b.paid_amount_cents END), 0) AS received
      FROM academy_billing b WHERE b.academy_id = ? AND b.reference_month BETWEEN ? AND ? GROUP BY b.reference_month ORDER BY b.reference_month`, academyId, from6, month),
    all(ctx, `SELECT p.id, p.name, COALESCE(sum(CASE WHEN ${live} THEN b.amount_cents - b.discount_cents END), 0) AS expected, COALESCE(sum(CASE WHEN b.billing_status = 'paid' THEN b.paid_amount_cents END), 0) AS received, count(*) AS n
      FROM academy_billing b JOIN academy_plans p ON p.id = b.plan_id AND p.academy_id = b.academy_id WHERE b.academy_id = ? AND b.reference_month = ? GROUP BY p.id ORDER BY expected DESC LIMIT 20`, academyId, month),
    first(ctx, `SELECT count(CASE WHEN status = 'active' THEN 1 END) AS active_n, COALESCE(sum(CASE WHEN status = 'active' THEN fee_cents END), 0) AS mrr, count(CASE WHEN status = 'paused' THEN 1 END) AS paused_n,
        count(CASE WHEN created_at >= ? THEN 1 END) AS new_30, count(CASE WHEN status = 'ended' AND end_date >= ? THEN 1 END) AS ended_30
      FROM student_contracts WHERE academy_id = ?`, new Date(ctx.now - 30 * 86400000).toISOString(), new Date(ctx.now - 30 * 86400000 - BRT_MS).toISOString().slice(0, 10), academyId),
    all(ctx, `SELECT b.paid_at, b.paid_amount_cents, b.payment_method, m.display_name AS student_name FROM academy_billing b JOIN academy_members m ON m.academy_id = b.academy_id AND m.user_id = b.student_uid
      WHERE b.academy_id = ? AND b.billing_status = 'paid' ORDER BY b.paid_at DESC, b.updated_at DESC LIMIT 5`, academyId),
    all(ctx, `SELECT b.*, m.display_name AS student_name, (SELECT name FROM academy_plans p WHERE p.id = b.plan_id AND p.academy_id = b.academy_id) AS plan_name FROM academy_billing b JOIN academy_members m ON m.academy_id = b.academy_id AND m.user_id = b.student_uid
      WHERE b.academy_id = ? AND b.billing_status = 'pending' AND b.due_date < ? ORDER BY b.due_date LIMIT 10`, academyId, today)
  ]);
  const overdueAll = await first(ctx, "SELECT count(*) AS n, COALESCE(sum(amount_cents - discount_cents), 0) AS cents FROM academy_billing WHERE academy_id = ? AND billing_status = 'pending' AND due_date < ?", academyId, today);
  const rate = totals.expected > 0 ? Math.round((totals.overdue_cents / totals.expected) * 1000) / 10 : 0;
  return {
    academyId, today, month,
    month_totals: { expectedCents: totals.expected, receivedCents: totals.received, pendingCents: totals.pending_cents, overdueCents: totals.overdue_cents, delinquencyPercent: rate, counts: { paid: totals.paid_count, pending: totals.pending_count, overdue: totals.overdue_count, exempt: totals.exempt_count } },
    overdueAllMonths: { count: overdueAll.n, cents: overdueAll.cents },
    series: series.map((s) => ({ month: s.month, expectedCents: s.expected, receivedCents: s.received })),
    byPlan: byPlan.map((p) => ({ planId: p.id, name: p.name, expectedCents: p.expected, receivedCents: p.received, charges: p.n })),
    contracts: { active: contracts.active_n, paused: contracts.paused_n, monthlyRecurringCents: contracts.mrr, averageTicketCents: contracts.active_n ? Math.round(contracts.mrr / contracts.active_n) : 0, started30d: contracts.new_30, ended30d: contracts.ended_30 },
    recentPayments: flow.map((r) => ({ paidAt: r.paid_at, paidAmountCents: r.paid_amount_cents, method: r.payment_method, studentName: r.student_name })),
    overdueTop: overdueTop.map((r) => view(r, today))
  };
}

// Exportação das cobranças (até 12 meses, 5000 linhas) para planilha; fica na auditoria.
export async function exportFinance(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, STAFF);
  const body = await readBody(ctx.request, SCHEMAS.exportFinance);
  if (body.fromMonth > body.toMonth || addMonths(body.fromMonth, 11) < body.toMonth) throw new ApiError('invalid_request');
  const today = todayBrt(ctx.now);
  await guarded(() => ctx.db.batch([auditStmt(ctx.db, ctx, { academyId, action: 'finance.exported', targetType: 'billing', targetId: `${body.fromMonth}_${body.toMonth}` })]));
  const rows = await all(ctx, `SELECT b.*, m.display_name AS student_name, (SELECT name FROM academy_plans p WHERE p.id = b.plan_id AND p.academy_id = b.academy_id) AS plan_name FROM academy_billing b JOIN academy_members m ON m.academy_id = b.academy_id AND m.user_id = b.student_uid
      WHERE b.academy_id = ? AND b.reference_month BETWEEN ? AND ? ORDER BY b.reference_month, m.display_name COLLATE NOCASE LIMIT 5001`, academyId, body.fromMonth, body.toMonth);
  return { exportedAt: ctx.nowIso, fromMonth: body.fromMonth, toMonth: body.toMonth, truncated: rows.length > 5000, charges: rows.slice(0, 5000).map((r) => view(r, today)) };
}
export { PAYMENT_METHODS };
