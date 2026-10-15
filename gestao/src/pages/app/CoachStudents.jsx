import React, { useState } from 'react';
import { friendlyError, newIdempotencyKey } from '../../api';
import { useApp } from '../../components/AppFrame';
import { ConfirmModal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AssignmentBadge, Avatar, ErrorState, TableSkeleton } from '../../components/ui';
import { useApi } from '../../session';

// Propostas do professor: ver as suas e propor acompanhamento a alunos sem professor. Só alunos com vínculo ATIVO e aceito aparecem na lista de Alunos.
export default function CoachProposals({ onChanged }) {
  const { api, academyId, role } = useApp();
  const toast = useToast();
  const [free, reloadFree] = useApi(() => api.unassignedStudents(academyId), [api, academyId]);
  const [props, reloadProps] = useApi(() => api.assignments(academyId), [api, academyId]);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(newIdempotencyKey);
  if (role !== 'coach') return null;

  const refresh = () => { reloadFree(); reloadProps(); onChanged?.(); };
  const propose = async () => {
    setBusy(true); setError('');
    try { await api.proposeCoach(academyId, { studentUid: target.userId }, attempt); setAttempt(newIdempotencyKey()); toast('Proposta enviada. A equipe precisa aprovar e o aluno aceitar.'); setTarget(null); refresh(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const ownProposals = (props.data?.assignments || []).filter((a) => a.status !== 'active');
  return (
    <>
      {ownProposals.length > 0 && (
        <section className="panel" aria-labelledby="minhas-propostas">
          <h2 id="minhas-propostas">Minhas propostas</h2>
          <ul className="rows">{ownProposals.map((a) => <li key={a.assignmentId} className="row"><span>{a.studentName}</span><AssignmentBadge status={a.status} /></li>)}</ul>
        </section>
      )}
      <section className="panel" aria-labelledby="pedir">
        <h2 id="pedir">Propor acompanhamento</h2>
        <p className="muted">Alunos da academia que ainda não têm professor. Sua proposta precisa ser aprovada pela equipe e aceita pelo aluno; só depois você passa a ver o aluno.</p>
        {free.status === 'loading' && <TableSkeleton rows={2} />}
        {free.status === 'error' && <ErrorState error={free.error} onRetry={reloadFree} />}
        {free.data && free.data.students.length === 0 && <p className="muted">Nenhum aluno disponível no momento.</p>}
        {free.data && free.data.students.length > 0 && (
          <ul className="rows">
            {free.data.students.map((s) => (
              <li key={s.userId} className="row">
                <span className="person"><Avatar name={s.displayName} /><span>{s.displayName}</span></span>
                <button type="button" className="btn" onClick={() => { setError(''); setTarget(s); }}>Propor vínculo</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {target && <ConfirmModal title={`Propor acompanhamento a ${target.displayName}?`} confirmLabel="Enviar proposta" busy={busy} error={error} onConfirm={propose} onClose={() => setTarget(null)}><p>A equipe analisa e o aluno decide. Você não terá acesso ao aluno antes do aceite.</p></ConfirmModal>}
    </>
  );
}
