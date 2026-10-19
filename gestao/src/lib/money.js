// Dinheiro e meses para o financeiro. O servidor sempre fala em centavos inteiros e em AAAA-MM; isto só apresenta e interpreta.
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatBRL = (cents) => brl.format((Number(cents) || 0) / 100);

/** "R$ 1.234,56", "1234,56", "1234.56" ou "99" -> centavos inteiros; texto inválido -> null. */
export function parseBRL(text) {
  let t = String(text ?? '').replace(/R\$|\s/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents >= 0 && cents <= 10000000 ? cents : null;
}

export const centsToInput = (cents) => (Number(cents) / 100).toFixed(2).replace('.', ',');

export const shiftMonth = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
};
export const monthShort = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))).replace('.', '');
};
export const dateBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

export const CHARGE_LABELS = { pending: 'A vencer', overdue: 'Em atraso', paid: 'Pago', exempt: 'Isento', canceled: 'Cancelado' };
export const CONTRACT_LABELS = { active: 'Ativo', paused: 'Pausado', ended: 'Encerrado' };

/** Linhas para planilha (separador ponto e vírgula e vírgula decimal, como o Excel em português espera). */
export function chargesToCsv(charges) {
  const head = ['Mês', 'Aluno', 'Plano', 'Vencimento', 'Valor', 'Desconto', 'Líquido', 'Situação', 'Pago em', 'Valor pago', 'Forma', 'Observação'];
  const num = (c) => (c / 100).toFixed(2).replace('.', ',');
  // Texto que o Excel leria como fórmula (começa com = + - @ ou tabulação) ganha um apóstrofo na frente; depois, aspas quando há ; " ou quebra de linha.
  const esc = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = charges.map((c) => [c.referenceMonth, c.studentName, c.planName, dateBR(c.dueDate), num(c.amountCents), num(c.discountCents), num(c.netCents), CHARGE_LABELS[c.status] || c.status, dateBR(c.paidAt), c.paidAmountCents == null ? '' : num(c.paidAmountCents), c.paymentMethod || '', c.note].map(esc).join(';'));
  return `﻿${[head.join(';'), ...rows].join('\r\n')}\r\n`;
}
