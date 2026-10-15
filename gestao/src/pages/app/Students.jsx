import React, { useEffect, useMemo, useState } from 'react';
import { LIMITS, STATUS_LABELS } from '../../../../shared/academy-contracts/index.js';
import ActionMenu from '../../components/ActionMenu';
import { useApp } from '../../components/AppFrame';
import AssignTrainingModal from '../../components/AssignTrainingModal';
import { useToast } from '../../components/Toast';
import { Avatar, EmptyState, ErrorState, Field, PageHeader, Pagination, StatusBadge, TableSkeleton } from '../../components/ui';
import { dateOf } from '../../lib/format';
import { canAssignTrainings } from '../../lib/policy';
import { plural } from '../../lib/format';
import { useApi } from '../../session';
import CoachProposals from './CoachStudents';

const PAGE_SIZE = 20;
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

// Alunos da academia. Dono e admin veem todos; o professor, só os que aceitaram o vínculo; a recepção, só o cadastro.
// Nunca aparece peso, medida, carga, histórico ou consentimento.
export default function Students() {
  const { api, academyId, role } = useApp();
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const [f, setF] = useState({ status: '', coach: '', training: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Map());
  const [assign, setAssign] = useState(null);
  const staff = ['owner', 'admin'].includes(role);
  const mayAssign = canAssignTrainings(role);
  const showTraining = role !== 'reception';
  useEffect(() => { setPage(1); }, [dq, f.status, f.coach, f.training, academyId]);
  useEffect(() => { setSelected(new Map()); }, [academyId]);

  const [list, reload] = useApi(() => api.students(academyId, { q: dq, status: f.status, coach: f.coach, training: f.training, page, pageSize: PAGE_SIZE }), [api, academyId, dq, f.status, f.coach, f.training, page]);
  const [coaches] = useApi(() => (staff ? api.members(academyId, { role: 'coach', status: 'active', pageSize: 50 }) : Promise.resolve(null)), [api, academyId, staff]);
  const setFilter = (key) => (e) => setF((x) => ({ ...x, [key]: e.target.value }));
  const d = list.data;
  const toggle = (s) => setSelected((m) => { const n = new Map(m); if (n.has(s.userId)) n.delete(s.userId); else if (n.size < LIMITS.batchMax) n.set(s.userId, s); return n; });
  const pageActive = useMemo(() => (d?.students || []).filter((s) => s.status === 'active'), [d]);
  const allOnPage = pageActive.length > 0 && pageActive.every((s) => selected.has(s.userId));
  const togglePage = () => setSelected((m) => { const n = new Map(m); if (allOnPage) pageActive.forEach((s) => n.delete(s.userId)); else pageActive.forEach((s) => { if (n.size < LIMITS.batchMax) n.set(s.userId, s); }); return n; });
  const done = (summary, name) => {
    toast(`${plural(summary.assign + summary.replace, 'aluno recebeu', 'alunos receberam')} "${name}"${summary.skip ? ` (${summary.skip} ignorado${summary.skip === 1 ? '' : 's'})` : ''}.`);
    setAssign(null); setSelected(new Map()); reload();
  };

  return (
    <>
      <PageHeader title="Alunos" subtitle={role === 'coach' ? 'Alunos que aceitaram ser acompanhados por você.' : role === 'reception' ? 'Cadastro dos alunos (visão operacional).' : 'Alunos da academia, seus professores e fichas. Nenhum dado de saúde ou desempenho aparece aqui.'}
        actions={mayAssign && selected.size > 0 && <button type="button" className="btn primary" onClick={() => setAssign([...selected.values()])}>Atribuir ficha a {selected.size}</button>} />
      <form className="filters" role="search" aria-label="Filtros de alunos" onSubmit={(e) => e.preventDefault()}>
        <Field id="s-q" label="Buscar por nome"><input id="s-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome" maxLength={60} /></Field>
        <Field id="s-status" label="Status"><select id="s-status" value={f.status} onChange={setFilter('status')}><option value="">{role === 'coach' ? 'Ativos' : 'Todos'}</option>{role !== 'coach' && Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {staff && <Field id="s-coach" label="Professor"><select id="s-coach" value={f.coach} onChange={setFilter('coach')}><option value="">Todos</option><option value="none">Sem professor</option>{(coaches.data?.members || []).map((c) => <option key={c.userId} value={c.userId}>{c.displayName}</option>)}</select></Field>}
        {showTraining && <Field id="s-training" label="Ficha"><select id="s-training" value={f.training} onChange={setFilter('training')}><option value="">Todas</option><option value="none">Sem ficha</option></select></Field>}
      </form>
      {list.status === 'loading' && <TableSkeleton />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={reload} />}
      {d && d.students.length === 0 && <EmptyState title="Nenhum aluno encontrado">{role === 'coach' ? 'Quando um aluno aceitar seu vínculo, ele aparece aqui. Você pode propor acompanhamento abaixo.' : 'Ajuste os filtros ou convide alunos na área de convites.'}</EmptyState>}
      {d && d.students.length > 0 && (
        <>
          <p className="muted small" aria-live="polite">{plural(d.total, 'aluno', 'alunos')}{selected.size > 0 ? ` · ${selected.size} selecionado${selected.size === 1 ? '' : 's'} (máximo ${LIMITS.batchMax})` : ''}</p>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Alunos da academia</caption>
              <thead>
                <tr>
                  {mayAssign && <th scope="col" className="check-col"><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Selecionar todos os alunos ativos desta página" /></th>}
                  <th scope="col">Nome</th><th scope="col">Status</th><th scope="col">Entrada</th>
                  {showTraining && <><th scope="col">Professor</th><th scope="col">Ficha</th></>}
                  {mayAssign && <th scope="col"><span className="visually-hidden">Ações</span></th>}
                </tr>
              </thead>
              <tbody>
                {d.students.map((s) => (
                  <tr key={s.userId}>
                    {mayAssign && <td className="check-col" data-label="Selecionar"><input type="checkbox" disabled={s.status !== 'active'} checked={selected.has(s.userId)} onChange={() => toggle(s)} aria-label={`Selecionar ${s.displayName || 'aluno'}`} /></td>}
                    <td data-label="Nome"><span className="person"><Avatar name={s.displayName} /><span>{s.displayName || 'Sem nome'}</span></span></td>
                    <td data-label="Status"><StatusBadge status={s.status} /></td>
                    <td data-label="Entrada">{dateOf(s.joinedAt)}</td>
                    {showTraining && (
                      <>
                        <td data-label="Professor">{s.coach ? s.coach.displayName : <span className="muted">{s.openAssignment ? 'Aguardando aceite' : 'Sem professor'}</span>}</td>
                        <td data-label="Ficha">
                          {s.training ? <span className="stack-tight"><span>{s.training.name} <span className="muted">v{s.training.version}</span></span>{s.training.outdated && <span className="badge status-suspended" title={`Existe a versão ${s.training.latestVersion}`}>Versão desatualizada</span>}</span> : <span className="muted">Sem ficha</span>}
                        </td>
                      </>
                    )}
                    {mayAssign && <td className="actions"><ActionMenu label={`Ações para ${s.displayName || 'aluno'}`} items={[s.status === 'active' && { label: s.training ? 'Trocar ficha' : 'Atribuir ficha', onClick: () => setAssign([s]) }]} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
        </>
      )}
      <CoachProposals onChanged={reload} />
      {assign && <AssignTrainingModal students={assign} onClose={() => setAssign(null)} onDone={done} />}
    </>
  );
}
