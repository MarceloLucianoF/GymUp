import React, { useCallback, useEffect, useState } from 'react';
import { ACTION_LABELS, ROLE_LABELS, STATUS_LABELS } from '../../../../shared/academy-contracts/index.js';
import { useApp } from '../../components/AppFrame';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '../../components/ui';
import { dateTimeOf } from '../../lib/format';

// Detalhe da auditoria em português: papéis e estados viram rótulos; o resto é texto curto (nunca dado sensível).
const detailText = (action, detail) => {
  if (!detail) return '';
  if (action === 'member.role_changed') return detail.split('>').map((r) => ROLE_LABELS[r] || r).join(' para ');
  if (action.startsWith('member.') || action === 'invite.created' || action === 'invite.revoked') return ROLE_LABELS[detail] || STATUS_LABELS[detail] || detail;
  if (action === 'academy.updated') return `Campos: ${detail.replace('name', 'nome').replace('description', 'descrição').replace('contactEmail', 'contato')}`;
  if (action === 'coach.revoked') return { transferencia: 'transferência', student: 'pelo aluno', coach: 'pelo professor', staff: 'pela equipe' }[detail] || detail;
  return detail;
};

export default function Audit() {
  const { api, academyId } = useApp();
  const [entries, setEntries] = useState([]);
  const [next, setNext] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const load = useCallback(async (before) => {
    setStatus(before ? 'more' : 'loading'); setError(null);
    try {
      const d = await api.audit(academyId, { limit: 25, before });
      setEntries((list) => (before ? [...list, ...d.entries] : d.entries));
      setNext(d.nextBefore);
      setStatus('ready');
    } catch (e) { setError(e); setStatus('error'); }
  }, [api, academyId]);
  useEffect(() => { setEntries([]); load(undefined); }, [load]);

  return (
    <>
      <PageHeader title="Auditoria" subtitle="Toda mudança administrativa deixa um registro que ninguém pode editar ou apagar. Leituras não são registradas." />
      {status === 'loading' && <TableSkeleton rows={6} />}
      {status === 'error' && <ErrorState error={error} onRetry={() => load(undefined)} />}
      {status !== 'loading' && entries.length === 0 && status !== 'error' && <EmptyState title="Nenhum registro ainda">As próximas mudanças aparecem aqui.</EmptyState>}
      {entries.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Registro de auditoria, do mais recente para o mais antigo</caption>
              <thead><tr><th scope="col">Quando</th><th scope="col">Quem</th><th scope="col">Ação</th><th scope="col">Alvo</th><th scope="col">Detalhe</th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Quando"><time dateTime={e.at}>{dateTimeOf(e.at)}</time></td>
                    <td data-label="Quem">{e.actorName || 'Ex-membro'}</td>
                    <td data-label="Ação">{ACTION_LABELS[e.action] || e.action}</td>
                    <td data-label="Alvo">{e.targetName || (e.targetType === 'academy' ? 'Academia' : e.targetType === 'invite' ? 'Convite' : e.targetType === 'assignment' ? 'Vínculo' : e.targetType === 'training' ? 'Ficha' : '-')}</td>
                    <td data-label="Detalhe">{detailText(e.action, e.detail) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {next ? <button type="button" className="btn" onClick={() => load(next)} disabled={status === 'more'}>{status === 'more' ? 'Carregando...' : 'Carregar mais'}</button> : <p className="muted small">Fim do registro.</p>}
        </>
      )}
    </>
  );
}
