import React, { useCallback, useEffect, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Modal from '../common/Modal';
import { acceptLink, listPendingForCoach, rejectLink, parseFee } from '../../services/coachLinkService';
import { btnPrimary, btnGhost, inputCls, labelCls } from './styles';

const fmt = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR'); };

// Solicitações de vínculo pendentes do treinador: aceitar ou recusar. O aluno só aparece na carteira depois do aceite.
export default function CoachRequests({ coachId, onAccepted }) {
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [accepting, setAccepting] = useState(null);   // linha aguardando a confirmação da mensalidade
  const [fee, setFee] = useState('');
  const [feeError, setFeeError] = useState('');
  const [defaultFee, setDefaultFee] = useState('');

  // Mensalidade padrão do treinador: só sugestão para o aluno novo (editável antes de confirmar).
  useEffect(() => {
    if (!coachId) return;
    getDoc(doc(db, 'users', coachId)).then((s) => { const v = s.exists() ? s.data().defaultMonthlyFee : ''; setDefaultFee(v ? String(v) : ''); }).catch(() => {});
  }, [coachId]);

  const load = useCallback(async () => {
    try { setRows(await listPendingForCoach(coachId)); }
    catch (error) { console.error(error); setRows([]); }
  }, [coachId]);

  useEffect(() => { if (coachId) load(); }, [coachId, load]);

  const act = async (row, kind) => {
    setBusyId(row.id);
    try {
      if (kind === 'accept') { await acceptLink(coachId, row.studentId, fee); setAccepting(null); toast.success(`${row.studentName || 'Aluno'} agora é seu aluno.`); onAccepted?.(); }
      else { await rejectLink(row.studentId); toast('Solicitação recusada.'); }
      await load();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível concluir. Tente de novo.');
    } finally { setBusyId(null); }
  };

  if (!rows || rows.length === 0) return null;
  return (
    <section aria-labelledby="req-title" className="surface space-y-3 border border-brand/30 p-4">
      <h2 id="req-title" className="flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white"><UserPlus className="h-5 w-5 text-amber-800 dark:text-brand" aria-hidden="true" /> Solicitações de alunos ({rows.length})</h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
            <div className="min-w-0 flex-1"><p className="truncate font-bold text-gray-900 dark:text-white">{row.studentName || 'Aluno'}</p><p className="text-xs text-gray-600 dark:text-gray-400">Pediu em {fmt(row.createdAt)}. Você só vê os dados dele depois de aceitar.</p></div>
            <div className="flex gap-2">
              <button type="button" disabled={busyId === row.id} onClick={() => { setAccepting(row); setFee(defaultFee); setFeeError(''); }} className="pressable inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-[#FF9800] px-4 text-sm font-black text-black disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" /> Aceitar</button>
              <button type="button" disabled={busyId === row.id} onClick={() => act(row, 'reject')} className="pressable inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gray-100 px-4 text-sm font-bold text-gray-800 disabled:opacity-50 dark:bg-white/10 dark:text-gray-100"><X className="h-4 w-4" aria-hidden="true" /> Recusar</button>
            </div>
          </li>
        ))}
      </ul>
      {accepting && (
        <Modal onClose={() => setAccepting(null)} label="Aceitar aluno" className="w-full max-w-sm">
          <form className="surface space-y-4 bg-white p-6 dark:bg-gray-900" onSubmit={(e) => {
            e.preventDefault();
            if (parseFee(fee) === null) { setFeeError('Informe uma mensalidade maior que zero.'); return; }
            act(accepting, 'accept');
          }}>
            <h3 className="font-display text-lg font-black text-gray-900 dark:text-white">Aceitar {accepting.studentName || 'aluno'}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Você passa a ver treinos, medidas e histórico dele. A mensalidade abaixo fica registrada no aluno (pagamento pendente) e você pode mudar depois no Financeiro.</p>
            <div>
              <label htmlFor="accept-fee" className={labelCls}>Mensalidade (R$)</label>
              <input id="accept-fee" type="text" inputMode="decimal" value={fee} onChange={(e) => { setFee(e.target.value); setFeeError(''); }} aria-invalid={feeError ? 'true' : undefined} aria-describedby="accept-fee-error" className={inputCls} placeholder="Ex: 120" />
              <p id="accept-fee-error" role="alert" className={feeError ? 'mt-1.5 text-sm font-medium text-rose-600' : 'sr-only'}>{feeError}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAccepting(null)} className={btnGhost}>Cancelar</button>
              <button type="submit" disabled={busyId === accepting.id} className={btnPrimary}>Aceitar aluno</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
