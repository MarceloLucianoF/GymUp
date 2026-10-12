import React, { useCallback, useEffect, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { acceptLink, listPendingForCoach, rejectLink } from '../../services/coachLinkService';

const fmt = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR'); };

// Solicitações de vínculo pendentes do treinador: aceitar ou recusar. O aluno só aparece na carteira depois do aceite.
export default function CoachRequests({ coachId, onAccepted }) {
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try { setRows(await listPendingForCoach(coachId)); }
    catch (error) { console.error(error); setRows([]); }
  }, [coachId]);

  useEffect(() => { if (coachId) load(); }, [coachId, load]);

  const act = async (row, kind) => {
    setBusyId(row.id);
    try {
      if (kind === 'accept') { await acceptLink(coachId, row.studentId); toast.success(`${row.studentName || 'Aluno'} agora é seu aluno.`); onAccepted?.(); }
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
              <button type="button" disabled={busyId === row.id} onClick={() => act(row, 'accept')} className="pressable inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-[#FF9800] px-4 text-sm font-black text-black disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" /> Aceitar</button>
              <button type="button" disabled={busyId === row.id} onClick={() => act(row, 'reject')} className="pressable inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gray-100 px-4 text-sm font-bold text-gray-800 disabled:opacity-50 dark:bg-white/10 dark:text-gray-100"><X className="h-4 w-4" aria-hidden="true" /> Recusar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
