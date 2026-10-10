// CSV para o Excel/Sheets em pt-BR: BOM UTF-8, CRLF, aspas duplicadas e proteção contra injeção de fórmulas.
export const CSV_BOM = '﻿';

export const csvEscape = (value, delimiter = ',') => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) value = Number.isNaN(value.getTime()) ? '' : value.toISOString();
  let text = String(value);
  // Texto que começa com = + - @ vira fórmula no Excel; o apóstrofo neutraliza (números não passam por aqui).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  const needsQuotes = text.includes(delimiter) || /[",\n\r;]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
};

// columns: [{ header, value: (row) => any }]
export const toCsv = (rows, columns, { delimiter = ',', bom = true } = {}) => {
  const lines = [columns.map((c) => csvEscape(c.header, delimiter)).join(delimiter)];
  rows.forEach((row) => lines.push(columns.map((c) => csvEscape(c.value(row), delimiter)).join(delimiter)));
  return (bom ? CSV_BOM : '') + lines.join('\r\n') + '\r\n';
};

const fmtDate = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '');
const STATUS_LABEL = { active: 'Ativo', risk: 'Em risco', new: 'Sem treino' };
const PAY_LABEL = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado' };

export const studentsCsv = (rows, opts = {}) => toCsv(rows, [
  { header: 'Nome', value: (r) => r.displayName || '' },
  { header: 'E-mail', value: (r) => r.email || '' },
  { header: 'Objetivo', value: (r) => r.goal || '' },
  { header: 'Último treino', value: (r) => fmtDate(r.lastWorkout) },
  { header: 'Status', value: (r) => STATUS_LABEL[r.status] || '' },
  { header: 'Mensalidade (R$)', value: (r) => (r.monthlyFee === undefined || r.monthlyFee === null ? '' : Number(r.monthlyFee).toFixed(2).replace('.', ',')) }
], opts);

export const financeCsv = (rows, monthLabel, opts = {}) => toCsv(rows, [
  { header: 'Mês de referência', value: () => monthLabel },
  { header: 'Aluno', value: (r) => r.displayName || '' },
  { header: 'E-mail', value: (r) => r.email || '' },
  { header: 'Valor (R$)', value: (r) => Number(r.monthlyFee || 0).toFixed(2).replace('.', ',') },
  { header: 'Situação', value: (r) => PAY_LABEL[r.paymentStatus] || PAY_LABEL.pending },
  { header: 'Data do pagamento', value: (r) => fmtDate(r.paymentDateObj) }
], opts);

export const downloadCsv = (filename, text) => {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
