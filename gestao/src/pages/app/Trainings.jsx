import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../components/AppFrame';
import { useToast } from '../../components/Toast';
import TrainingEditor from '../../components/TrainingEditor';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '../../components/ui';
import { dateOf, plural } from '../../lib/format';
import { canCreateTrainings } from '../../lib/policy';
import { TEMPLATE_STATUS } from '../../lib/trainings';
import { useApi } from '../../session';

// Fichas da academia. Rascunho edita-se à vontade; cada publicação cria uma versão imutável e é a versão que o aluno recebe.
export default function Trainings() {
  const { api, academyId, role, current } = useApp();
  const mayCreate = canCreateTrainings(current);
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');
  const [creating, setCreating] = useState(false);
  const [list, reload] = useApi(() => api.trainings(academyId, { status: tab }), [api, academyId, tab]);
  if (!['owner', 'admin', 'coach'].includes(role)) return <Navigate to="/app" replace />;
  const d = list.data;
  const create = async (payload) => {
    const r = await api.createTraining(academyId, payload);
    toast('Ficha criada como rascunho. Publique para criar a versão 1.');
    setCreating(false);
    navigate(`/app/academia/${academyId}/fichas/${r.templateId}`);
  };
  return (
    <>
      <PageHeader title="Fichas" subtitle="Crie fichas, publique versões e atribua aos alunos. Quem já tem uma ficha continua com a versão que recebeu."
        actions={mayCreate ? <button type="button" className="btn primary" onClick={() => setCreating(true)}>Nova ficha</button> : null} />
      <div className="tabs" role="tablist" aria-label="Situação das fichas">
        {['active', 'archived'].map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'tab on' : 'tab'} onClick={() => setTab(t)}>{t === 'active' ? 'Ativas' : 'Arquivadas'}</button>)}
      </div>
      {list.status === 'loading' && <TableSkeleton rows={4} />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={reload} />}
      {d && d.templates.length === 0 && <EmptyState title={tab === 'active' ? 'Nenhuma ficha ativa' : 'Nenhuma ficha arquivada'} action={tab === 'active' && mayCreate ? <button type="button" className="btn primary" onClick={() => setCreating(true)}>Criar a primeira ficha</button> : null}>{tab === 'active' ? mayCreate ? 'Crie uma ficha, publique e atribua aos alunos.' : 'Peça ao dono ou a um administrador a permissão de criar fichas.' : 'Fichas arquivadas ficam aqui e podem ser restauradas.'}</EmptyState>}
      {d && d.templates.length > 0 && (
        <ul className="cards" aria-label="Fichas">
          {d.templates.map((t) => (
            <li key={t.templateId} className="card">
              <Link to={`/app/academia/${academyId}/fichas/${t.templateId}`} className="card-link">
                <strong>{t.name}</strong>
                <span className="muted small">{t.description || 'Sem descrição'}</span>
              </Link>
              <div className="card-meta">
                <span className={`badge ${t.status === 'active' ? 'status-active' : 'status-removed'}`}>{TEMPLATE_STATUS[t.status]}</span>
                <span className="muted small">{t.currentVersion === 0 ? 'Rascunho, sem versão publicada' : `Versão ${t.currentVersion}`}</span>
                {t.assignedCount !== undefined && <span className="muted small">{plural(t.assignedCount, 'aluno', 'alunos')}</span>}
                {t.mine && <span className="muted small">Criada por você</span>}
                <span className="muted small">Atualizada em {dateOf(t.updatedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {creating && <TrainingEditor onSave={create} onClose={() => setCreating(false)} />}
    </>
  );
}
