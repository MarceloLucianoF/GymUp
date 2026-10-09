import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trophy, BarChart2 } from 'lucide-react';
import useExerciseHistory from '../../hooks/useExerciseHistory';
import { groupExercises, computeTrend, detectRecords, hasRecentRecord, timeSeries } from '../../utils/analytics';
import PageHeader from '../../components/ui/PageHeader';
import Sparkline from '../../components/ui/Sparkline';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { SkeletonList } from '../../components/common/Skeleton';
import { TrendBadge } from '../../components/analytics';

const SORTS = [
  { id: 'recent', label: 'Mais recentes' },
  { id: 'gain', label: 'Maior evolução' },
  { id: 'name', label: 'Nome' },
];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ExerciseProgressList() {
  const navigate = useNavigate();
  const { checkIns, loading, error } = useExerciseHistory();
  const [term, setTerm] = useState('');
  const [group, setGroup] = useState('');
  const [sort, setSort] = useState('recent');

  const items = useMemo(() => groupExercises(checkIns).map((e) => {
    const last = e.sessions[e.sessions.length - 1];
    const records = detectRecords(e.sessions);
    return {
      ...e,
      last,
      trend: computeTrend(e.sessions, 'e1rm'),
      series: timeSeries(e.sessions, 'e1rm').map((p) => p.value),
      recent: hasRecentRecord(records, 14),
    };
  }), [checkIns]);

  const groups = useMemo(() => [...new Set(items.map((i) => i.muscleGroup).filter(Boolean))].sort(), [items]);

  const visible = useMemo(() => {
    const t = norm(term);
    const list = items.filter((i) => (!group || i.muscleGroup === group) && (!t || norm(i.name).includes(t)));
    const by = {
      recent: (a, b) => b.last.ts - a.last.ts,
      gain: (a, b) => (b.trend.enough ? b.trend.percentPerMonth : -Infinity) - (a.trend.enough ? a.trend.percentPerMonth : -Infinity),
      name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
    };
    return [...list].sort(by[sort]);
  }, [items, term, group, sort]);

  const chip = (active) => `pressable shrink-0 px-3.5 min-h-[36px] rounded-full text-xs font-bold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${active ? 'bg-brand text-black border-brand' : 'surface text-gray-600 dark:text-gray-300'}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8 pb-32">
      <div className="max-w-3xl mx-auto">
        <PageHeader eyebrow="Análises" title="Evolução por exercício" subtitle="Toque em um exercício para ver cargas, 1RM e volume." />

        {loading ? <SkeletonList count={5} itemClassName="h-20 w-full" />
          : error ? <ErrorState message="Não foi possível carregar seu histórico." />
          : items.length === 0 ? (
            <EmptyState icon={BarChart2} title="Nenhum exercício registrado" description="Conclua um treino para acompanhar sua evolução aqui." />
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar exercício" aria-label="Buscar exercício"
                  className="w-full min-h-[44px] pl-10 pr-3 rounded-2xl surface text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" role="group" aria-label="Filtrar por grupo muscular">
                <button type="button" className={chip(!group)} aria-pressed={!group} onClick={() => setGroup('')}>Todos</button>
                {groups.map((g) => <button key={g} type="button" className={chip(group === g)} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1" role="group" aria-label="Ordenar">
                {SORTS.map((s) => <button key={s.id} type="button" className={chip(sort === s.id)} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>)}
              </div>

              {visible.length === 0 ? <EmptyState icon={Search} title="Nada encontrado" description="Ajuste a busca ou o filtro." /> : (
                <ul className="space-y-3">
                  {visible.map((i, idx) => (
                    <li key={i.name} className="animate-fade-up" style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
                      <button type="button" onClick={() => navigate(`/analytics/${encodeURIComponent(i.name)}`)}
                        className="pressable surface w-full p-4 flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{i.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{i.muscleGroup || 'Sem grupo'} · {i.sessions.length} treino{i.sessions.length > 1 ? 's' : ''}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-sm font-black text-amber-600 dark:text-brand">{i.last.maxWeight > 0 ? `${i.last.maxWeight} kg` : `${i.last.totalReps} reps`}</span>
                            <TrendBadge trend={i.trend} />
                            {i.recent && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded"><Trophy className="w-3 h-3" aria-hidden="true" />Recorde</span>}
                          </div>
                        </div>
                        {i.series.length >= 2 ? <Sparkline data={i.series} width={80} height={32} className="shrink-0" /> : <span className="text-xs text-gray-400 shrink-0" aria-hidden="true">-</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
      </div>
    </div>
  );
}
