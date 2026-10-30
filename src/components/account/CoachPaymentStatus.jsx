import React from 'react';
import { feeOf, isExempt } from '../../utils/billing';
import { formatDate } from '../../utils/format';

const STATUS = {
  paid: ['Em dia', 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'],
  pending: ['Pendente', 'bg-amber-500/15 text-amber-800 dark:text-amber-300'],
  overdue: ['Atrasada', 'bg-rose-500/15 text-rose-800 dark:text-rose-300'],
  exempt: ['Isento', 'bg-gray-500/15 text-gray-800 dark:text-gray-200']
};
const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Situação da mensalidade com o treinador vinculado, como ele registrou (o pagamento é combinado direto entre os dois).
export default function CoachPaymentStatus({ profile }) {
  if (!profile?.coachId) return null;
  const exempt = isExempt(profile);
  const status = exempt ? 'exempt' : STATUS[profile.paymentStatus] ? profile.paymentStatus : 'pending';
  const [label, tone] = STATUS[status];
  const hasFee = exempt || profile.monthlyFee !== undefined;
  const paidAt = status === 'paid' ? profile.paymentDate || profile.lastPaymentUpdate : null;

  return (
    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5" aria-labelledby="payment-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="payment-title" className="text-sm font-bold text-gray-900 dark:text-white">Mensalidade</p>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label}</span>
      </div>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
        {exempt ? 'Seu treinador marcou você como isento.' : hasFee ? `${brl(feeOf(profile))} por mês.` : 'Seu treinador ainda não registrou o valor.'}
        {paidAt && ` Último pagamento registrado em ${formatDate(paidAt)}.`}
        {status === 'overdue' && ' Fale com seu treinador para regularizar.'}
      </p>
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">O pagamento é combinado direto com o treinador; aqui aparece a situação que ele registrou.</p>
    </div>
  );
}
