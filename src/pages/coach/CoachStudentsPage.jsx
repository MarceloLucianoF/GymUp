import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, MessageSquare, ClipboardList, Users, DollarSign, ChevronRight, ArrowUpDown, Download, X } from 'lucide-react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useCoachRoster, lastWorkoutMap } from '../../hooks/useCoachRoster';
import PageHeader from '../../components/ui/PageHeader';
import Reveal from '../../components/ui/Reveal';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/coach/Avatar';
import StatusBadge from '../../components/coach/StatusBadge';
import InviteModal from '../../components/coach/InviteModal';
import AssignTrainingModal from '../../components/coach/AssignTrainingModal';
import BulkAssignModal from '../../components/coach/BulkAssignModal';
import AdherenceHeatmap from '../../components/coach/AdherenceHeatmap';
import { adherenceByStudent } from '../../utils/coachInsights';
import { studentsCsv, downloadCsv } from '../../utils/coachCsv';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { chatState, studentStatus, timeAgo } from '../../components/coach/helpers';
import { btnPrimary, btnGhost, inputCls, pageCls } from '../../components/coach/styles';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'risk', label: 'Em risco' },
  { id: 'notraining', label: 'Sem ficha' }
];

const SORTS = [
  { id: 'name', label: 'Nome (A-Z)' },
  { id: 'recent', label: 'Treinou recentemente' },
  { id: 'inactive', label: 'Mais tempo parado' },
  { id: 'adherence', label: 'Maior aderência' },
  { id: 'adherence-asc', label: 'Menor aderência' }
];

// Últimos filtro e ordenação usados ficam salvos neste navegador.
const VIEW_KEY = 'academyup.coach.studentsView.v1';
const loadView = () => {
  try {
    const v = JSON.parse(window.localStorage.getItem(VIEW_KEY) || '{}');
    return {
      filter: FILTERS.some((f) => f.id === v.filter) ? v.filter : 'all',
      sort: SORTS.some((o) => o.id === v.sort) ? v.sort : 'name'
    };
  } catch {
    return { filter: 'all', sort: 'name' };
  }
};
const saveView = (view) => { try { window.localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* sem storage */ } };

export default function CoachStudentsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { students, trainings, checkIns, loading, error, reload, setStudents } = useCoachRoster(user);

  const [search, setSearch] = useState('');
  const [initialView] = useState(loadView);
  const [filter, setFilterState] = useState(initialView.filter);
  const [sort, setSortState] = useState(initialView.sort);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const setFilter = (value) => { setFilterState(value); saveView({ filter: value, sort }); };
  const setSort = (value) => { setSortState(value); saveView({ filter, sort: value }); };
  const [assigning, setAssigning] = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  const rows = useMemo(() => {
    const now = new Date();
    const last = lastWorkoutMap(students, checkIns);
    const adherence = adherenceByStudent(students, checkIns, now);
    return students.map((s) => {
      const training = trainings.find((t) => t.id === s.currentTrainingId);
      return {
        ...s,
        lastWorkout: last[s.uid] || null,
        adherence: adherence[s.uid],
        status: studentStatus(last[s.uid], now),
        trainingName: s.currentTrainingId ? (training?.name || 'Ficha removida') : null
      };
    });
  }, [students, trainings, checkIns]);

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    risk: rows.filter((r) => r.status !== 'active').length,
    notraining: rows.filter((r) => !r.currentTrainingId).length
  }), [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (term && !`${r.displayName || ''} ${r.email || ''}`.toLowerCase().includes(term)) return false;
      if (filter === 'active') return r.status === 'active';
      if (filter === 'risk') return r.status !== 'active';
      if (filter === 'notraining') return !r.currentTrainingId;
      return true;
    });
    const byName = (a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR');
    const time = (r) => (r.lastWorkout ? r.lastWorkout.getTime() : 0);
    const pct = (r) => r.adherence?.pct ?? 0;
    if (sort === 'adherence') return list.sort((a, b) => pct(b) - pct(a) || byName(a, b));
    if (sort === 'adherence-asc') return list.sort((a, b) => pct(a) - pct(b) || byName(a, b));
    return list.sort(sort === 'recent' ? (a, b) => time(b) - time(a) : sort === 'inactive' ? (a, b) => time(a) - time(b) : byName);
  }, [rows, search, filter, sort]);

  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)));
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const exportCsv = () => {
    // ';' abre em colunas no Excel pt-BR
    downloadCsv(`alunos-${new Date().toISOString().slice(0, 10)}.csv`, studentsCsv(visible, { delimiter: ';' }));
  };
  const onBulkDone = (ids, trainingId) => setStudents((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, currentTrainingId: trainingId } : s)));

  const openChat = (s) => navigate('/coach/chat', { state: chatState(s) });
  const onAssigned = (studentId) => (trainingId) => setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, currentTrainingId: trainingId } : s)));

  if (loading) return <div className={pageCls}><div className="mx-auto max-w-6xl"><PageSkeleton cards={3} /></div></div>;
  if (error) return <div className={pageCls}><ErrorState onRetry={reload} /></div>;

  return (
    <div className={pageCls}>
      <div className="mx-auto max-w-6xl space-y-5">
        <PageHeader
          eyebrow="Carteira"
          title="Meus alunos"
          subtitle={`${rows.length} aluno${rows.length === 1 ? '' : 's'} vinculado${rows.length === 1 ? '' : 's'}`}
          actions={(
            <div className="flex gap-2">
              <button type="button" onClick={exportCsv} disabled={visible.length === 0} className={btnGhost}><Download className="h-4 w-4" /> CSV</button>
              <button type="button" onClick={() => setShowInvite(true)} className={btnPrimary}><UserPlus className="h-4 w-4" /> Convidar</button>
            </div>
          )}
        />

        <div className="surface space-y-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input type="search" aria-label="Buscar aluno" placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} pl-11`} />
            </div>
            <label className="relative sm:w-60">
              <span className="sr-only">Ordenar</span>
              <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} cursor-pointer pl-11`}>
                {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Filtros">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                className={`pressable min-h-[44px] shrink-0 rounded-2xl px-4 text-sm font-bold transition ${filter === f.id ? 'bg-brand text-black' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>
                {f.label} <span className="ml-1 text-xs opacity-70">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="surface"><EmptyState icon={Users} title="Nenhum aluno vinculado ainda." description="Envie seu código de convite para começar." action={<button type="button" onClick={() => setShowInvite(true)} className={btnPrimary}>Convidar aluno</button>} /></div>
        ) : visible.length === 0 ? (
          <div className="surface"><EmptyState icon={Search} title="Nenhum aluno encontrado." description="Ajuste a busca ou os filtros." /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 px-1">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-5 w-5 accent-brand" />
                Selecionar todos ({visible.length})
              </label>
            </div>
            {/* Mobile: cards */}
            <ul className="space-y-3 md:hidden">
              {visible.map((s, i) => (
                <Reveal as="li" key={s.id} delay={Math.min(i, 6) * 40}>
                  <div className={`surface p-4 ${selected.has(s.id) ? 'ring-2 ring-brand' : ''}`}>
                    <div className="flex items-center gap-3">
                    <input type="checkbox" aria-label={`Selecionar ${s.displayName || 'aluno'}`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-6 w-6 shrink-0 accent-brand" />
                    <button type="button" onClick={() => navigate(`/coach/students/${s.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <Avatar name={s.displayName} src={s.photoURL} size="lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base font-black text-gray-900 dark:text-white">{s.displayName || 'Aluno'}</span>
                        <span className="block truncate text-xs text-gray-500">{s.lastWorkout ? `Treinou ${timeAgo(s.lastWorkout)}` : 'Ainda não treinou'}</span>
                        <StatusBadge status={s.status} className="mt-1.5" />
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <AdherenceHeatmap grid={s.adherence.grid} size="sm" />
                        <span className="text-[11px] font-bold text-gray-500">{s.adherence.pct}% aderência</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                    </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-2xl bg-gray-100 p-2 dark:bg-white/5">
                      <ClipboardList className="ml-1 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${s.trainingName ? 'text-gray-800 dark:text-gray-100' : 'italic text-gray-400'}`}>{s.trainingName || 'Sem ficha ativa'}</span>
                      <button type="button" onClick={() => setAssigning(s)} className="pressable min-h-[44px] rounded-xl bg-brand px-3 text-xs font-bold text-black">{s.trainingName ? 'Trocar' : 'Atribuir'}</button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openChat(s)} className="pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-sky-500/10 text-sm font-bold text-sky-600"><MessageSquare className="h-4 w-4" /> Chat</button>
                      <button type="button" onClick={() => navigate('/coach/financial')} className="pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 text-sm font-bold text-emerald-600"><DollarSign className="h-4 w-4" /> Financeiro</button>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>

            {/* Desktop: tabela */}
            <Reveal className="hidden md:block">
              <div className="surface overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-white/5">
                    <tr>
                      <th scope="col" className="w-12 p-4"><span className="sr-only">Selecionar</span></th>
                      <th scope="col" className="p-4">Aluno</th>
                      <th scope="col" className="p-4">Status</th>
                      <th scope="col" className="p-4">Último treino</th>
                      <th scope="col" className="p-4">Aderência (4 sem.)</th>
                      <th scope="col" className="p-4">Ficha atual</th>
                      <th scope="col" className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {visible.map((s) => (
                      <tr key={s.id} className={`transition-colors hover:bg-brand/5 ${selected.has(s.id) ? 'bg-brand/10' : ''}`}>
                        <td className="p-4"><input type="checkbox" aria-label={`Selecionar ${s.displayName || 'aluno'}`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-5 w-5 accent-brand" /></td>
                        <td className="p-4">
                          <button type="button" onClick={() => navigate(`/coach/students/${s.id}`)} className="flex items-center gap-3 text-left">
                            <Avatar name={s.displayName} src={s.photoURL} />
                            <span>
                              <span className="block font-bold text-gray-900 dark:text-white">{s.displayName || 'Aluno'}</span>
                              <span className="block text-xs text-gray-500">{s.email}</span>
                            </span>
                          </button>
                        </td>
                        <td className="p-4"><StatusBadge status={s.status} /></td>
                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{s.lastWorkout ? timeAgo(s.lastWorkout) : '-'}</td>
                        <td className="p-4"><div className="flex items-center gap-2"><AdherenceHeatmap grid={s.adherence.grid} size="sm" /><span className="text-xs font-bold text-gray-500">{s.adherence.pct}%</span></div></td>
                        <td className="p-4">
                          <button type="button" onClick={() => setAssigning(s)} className={`min-h-[44px] max-w-[220px] truncate rounded-xl px-3 text-sm font-semibold hover:bg-brand/15 ${s.trainingName ? 'text-gray-800 dark:text-gray-100' : 'italic text-gray-400'}`}>
                            {s.trainingName || 'Atribuir ficha'}
                          </button>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button type="button" aria-label={`Chat com ${s.displayName || 'aluno'}`} title="Chat" onClick={() => openChat(s)} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600"><MessageSquare className="h-4 w-4" /></button>
                            <button type="button" aria-label={`Financeiro de ${s.displayName || 'aluno'}`} title="Financeiro" onClick={() => navigate('/coach/financial')} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"><DollarSign className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </>
        )}
      </div>

      {selected.size > 0 && (
        <div role="region" aria-label="Ações em lote" className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-xl items-center gap-2 rounded-3xl border border-brand/40 bg-white p-3 shadow-2xl dark:bg-gray-900 md:bottom-6">
          <span className="flex-1 pl-2 text-sm font-bold text-gray-900 dark:text-white">{selected.size} selecionado{selected.size === 1 ? '' : 's'}</span>
          <button type="button" onClick={() => setBulkOpen(true)} className={btnPrimary}><ClipboardList className="h-4 w-4" /> Atribuir ficha</button>
          <button type="button" aria-label="Limpar seleção" onClick={() => setSelected(new Set())} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
      )}
      {bulkOpen && (
        <BulkAssignModal students={selectedRows} trainings={trainings} onClose={() => { setBulkOpen(false); setSelected(new Set()); }}
          onDone={onBulkDone} onCreateTraining={() => navigate('/admin/trainings')} />
      )}
      {assigning && (
        <AssignTrainingModal student={assigning} trainings={trainings} onClose={() => setAssigning(null)}
          onAssigned={onAssigned(assigning.id)} onCreateTraining={() => navigate('/admin/trainings')} />
      )}
      {showInvite && <InviteModal coachCode={user.uid} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
