// Cobrança do aluno: pago | pendente | atrasado | isento. "Isento" = mensalidade 0 + situação 'exempt' (sempre juntas):
// não entra no previsto, no a receber nem nos inadimplentes, e não tem ação de pagar ou cobrar.
export const DEFAULT_FEE = 120;
export const EXEMPT = 'exempt';

// Isento: situação 'exempt' ou, em cadastros antigos, mensalidade 0 gravada (zero nunca vira o valor padrão).
export const isExempt = (s) => s?.paymentStatus === EXEMPT || s?.monthlyFee === 0;

/** Mensalidade do aluno: isento vale 0; sem valor registrado usa o padrão. Zero gravado NÃO vira o padrão. */
export const feeOf = (data, fallback = DEFAULT_FEE) => {
  if (isExempt(data)) return 0;
  const raw = data?.monthlyFee;
  if (raw === 0 || raw === '0') return 0;
  return Number(raw) || fallback;
};

const sum = (arr) => arr.reduce((acc, s) => acc + (Number(s.monthlyFee) || 0), 0);

/** Resumo do mês só com quem paga: isentos ficam fora de previsto, recebido, a receber e inadimplentes. */
export const computeStats = (list) => {
  const payers = list.filter((s) => !isExempt(s));
  const total = sum(payers);
  const received = sum(payers.filter((s) => s.paymentStatus === 'paid'));
  const overdue = payers.filter((s) => s.paymentStatus === 'overdue');
  return {
    total, received, pending: total - received,
    overdueCount: overdue.length, overdueTotal: sum(overdue),
    exemptCount: list.length - payers.length,
    pct: total ? Math.round((received / total) * 100) : 0
  };
};

export const statusTotals = (list) => ['paid', 'pending', 'overdue', EXEMPT].map((id) => {
  const items = list.filter((s) => (s.paymentStatus || 'pending') === id);
  return { id, count: items.length, total: id === EXEMPT ? 0 : sum(items) };
});

/** Campos a gravar ao editar a mensalidade: 0 vira isento; voltar a um valor positivo tira o isento (fica pendente). */
export const feeUpdate = (student, fee, now = new Date().toISOString()) => {
  if (fee === 0) return { monthlyFee: 0, paymentStatus: EXEMPT, lastPaymentUpdate: now };
  if (isExempt(student)) return { monthlyFee: fee, paymentStatus: 'pending', lastPaymentUpdate: now };
  return { monthlyFee: fee };
};
