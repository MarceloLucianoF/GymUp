import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, MessageSquare, ClipboardList, Users, DollarSign, ChevronRight, ArrowUpDown } from 'lucide-react';
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
import PageSkeleton from '../../components/coach/PageSkeleton';
import { chatState, studentStatus, timeAgo } from '../../components/coach/helpers';
import { btnPrimary, inputCls, pageCls } from '../../components/coach/styles';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'risk', label: 'Em risco' },
  { id: 'notraining', label: 'Sem ficha' }
];

const SORTS = [
  { id: 'name', label: 'Nome (A-Z)' },
  { id: 'recent', label: 'Treinou recentemente' },
  { id: 'inactive', label: 'Mais tempo parado' }
];

export default function CoachStudentsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { students, trainings, checkIns, loading, error, reload, setStudents } = useCoachRoster(user);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [assigning, setAssigning] = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  const rows = useMemo(() => {
    const now = new Date();
    const last = lastWorkoutMap(students, checkIns);
    return students.map((s) => {
      const training = trainings.find((t) => t.id === s.currentTrainingId);
      return {
        ...s,
        lastWorkout: last[s.uid] || null,
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
    return list.sort(sort === 'recent' ? (a, b) => time(b) - time(a) : sort === 'inactive' ? (a, b) => time(a) - time(b) : byName);
  }, [rows, search, filter, sort]);

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
          actions={<button type="button" onClick={() => setShowInvite(true)} className={btnPrimary}><UserPlus className="h-4 w-4" /> Convidar</button>}
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
            {/* Mobile: cards */}
            <ul className="space-y-3 md:hidden">
              {visible.map((s, i) => (
                <Reveal as="li" key={s.id} delay={Math.min(i, 6) * 40}>
                  <div className="surface p-4">
                    <button type="button" onClick={() => navigate(`/coach/students/${s.id}`)} className="flex w-full items-center gap-3 text-left">
                      <Avatar name={s.displayName} src={s.photoURL} size="lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base font-black text-gray-900 dark:text-white">{s.displayName || 'Aluno'}</span>
                        <span className="block truncate text-xs text-gray-500">{s.lastWorkout ? `Treinou ${timeAgo(s.lastWorkout)}` : 'Ainda não treinou'}</span>
                        <StatusBadge status={s.status} className="mt-1.5" />
                      </span>
                      <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </button>
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
                      <th scope="col" className="p-4">Aluno</th>
                      <th scope="col" className="p-4">Status</th>
                      <th scope="col" className="p-4">Último treino</th>
                      <th scope="col" className="p-4">Ficha atual</th>
                      <th scope="col" className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {visible.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-brand/5">
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

      {assigning && (
        <AssignTrainingModal student={assigning} trainings={trainings} onClose={() => setAssigning(null)}
          onAssigned={onAssigned(assigning.id)} onCreateTraining={() => navigate('/admin/trainings')} />
      )}
      {showInvite && <InviteModal coachCode={user.uid} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
