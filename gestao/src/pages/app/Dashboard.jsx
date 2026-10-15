import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ACTION_LABELS } from '../../../../shared/academy-contracts/index.js';
import { useApp } from '../../components/AppFrame';
import { ErrorState, PageHeader, TableSkeleton } from '../../components/ui';
import { relativeTime } from '../../lib/format';
import { useApi } from '../../session';

function Stat({ label, value, to, hint }) {
  const body = (<><span className="stat-value">{value ?? '-'}</span><span className="stat-label">{label}</span>{hint && <span className="muted small">{hint}</span>}</>);
  return to ? <Link to={to} className="stat link-card">{body}</Link> : <div className="stat">{body}</div>;
}

export default function Dashboard() {
  const { api, academyId, role, current } = useApp();
  const [state, reload] = useApi(() => api.dashboard(academyId), [api, academyId]);
  if (role === 'coach') return <Navigate to={`/app/academia/${academyId}/alunos`} replace />;
  const base = `/app/academia/${academyId}`;
  const d = state.data;
  const staff = role === 'owner' || role === 'admin';
  return (
    <>
      <PageHeader title={current.academy.name} subtitle="Resumo operacional da sua academia. Sem peso, medidas, cargas ou dados de saúde." />
      {state.status === 'loading' && <TableSkeleton rows={3} />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={reload} />}
      {d && (
        <>
          <section className="stats" aria-label="Indicadores">
            <Stat label="Membros ativos" value={d.counts.members} to={`${base}/membros`} />
            <Stat label="Convites pendentes" value={d.counts.pendingInvites} to={`${base}/convites`} />
            <Stat label="Professores ativos" value={d.counts.coaches} to={staff ? `${base}/membros?role=coach` : undefined} />
            <Stat label="Alunos sem professor" value={d.counts.studentsWithoutCoach} to={`${base}/alunos?coach=none`} hint={`de ${d.counts.students} alunos`} />
            {staff && <Stat label="Alunos sem ficha" value={d.counts.studentsWithoutTraining} to={`${base}/alunos?training=none`} hint="ainda sem treino atribuído" />}
            {staff && <Stat label="Fichas desatualizadas" value={d.counts.studentsOutdated} to={`${base}/alunos?training=outdated`} hint="aluno numa versão antiga" />}
            {staff && <Stat label="Fichas ativas" value={d.counts.activeTrainings} to={`${base}/fichas`} hint="com versão publicada" />}
            {staff && <Stat label="Vínculos aguardando" value={d.counts.pendingAssignments} to={`${base}/membros`} hint="proposta ou aceite do aluno" />}
          </section>
          <section aria-labelledby="atalhos">
            <h2 id="atalhos">Atalhos</h2>
            <div className="shortcuts">
              <Link className="btn primary" to={`${base}/convites`}>Criar convite</Link>
              <Link className="btn" to={`${base}/alunos`}>Ver alunos</Link>
              {staff && <Link className="btn" to={`${base}/fichas`}>Ver fichas</Link>}
              <Link className="btn" to={`${base}/membros`}>Gerenciar membros</Link>
              {staff && <Link className="btn" to={base}>Configurar academia</Link>}
              {staff && <Link className="btn" to={`${base}/auditoria`}>Ver auditoria</Link>}
            </div>
          </section>
          {staff && (
            <section aria-labelledby="atividade">
              <h2 id="atividade">Atividade administrativa recente</h2>
              {d.recentActivity.length === 0 ? <p className="muted">Nenhuma atividade ainda.</p> : (
                <ul className="feed">
                  {d.recentActivity.map((e) => (
                    <li key={e.id}><span>{ACTION_LABELS[e.action] || e.action}</span><span className="muted">{e.actorName || 'Alguém'} · <time dateTime={e.at}>{relativeTime(e.at)}</time></span></li>
                  ))}
                </ul>
              )}
              <Link to={`${base}/auditoria`} className="link">Ver toda a auditoria</Link>
            </section>
          )}
        </>
      )}
    </>
  );
}
