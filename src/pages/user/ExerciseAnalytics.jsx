import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart2, Trophy, Target, Lightbulb, TrendingUp } from 'lucide-react';
import useExerciseHistory from '../../hooks/useExerciseHistory';
import {
  buildExerciseHistory, timeSeries, detectRecords, computeTrend, suggestNextLoad, filterByPeriod,
} from '../../utils/analytics';
import { formatDate, formatTonnage } from '../../utils/format';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { ExerciseChart, TrendBadge } from '../../components/analytics';

const TABS = [
  { id: 'weight', label: 'Carga', unit: 'kg' },
  { id: 'e1rm', label: '1RM estimado', unit: 'kg' },
  { id: 'volume', label: 'Volume', unit: 'kg' },
];
const PERIODS = [{ id: 30, label: '30 dias' }, { id: 90, label: '90 dias' }, { id: 0, label: 'Tudo' }];
const dec = (n) => String(n).replace('.', ',');

export default function ExerciseAnalytics() {
  const { exerciseName } = useParams();
  const navigate = useNavigate();
  const { checkIns, loading, error } = useExerciseHistory();
  const [tab, setTab] = useState('weight');
  const [period, setPeriod] = useState(0);

  let cleanName = exerciseName || '';
  try { cleanName = decodeURIComponent(cleanName); } catch { /* mantém o valor bruto */ }

  const sessions = useMemo(() => buildExerciseHistory(checkIns, cleanName), [checkIns, cleanName]);
  const records = useMemo(() => detectRecords(sessions), [sessions]);
  const trend = useMemo(() => computeTrend(sessions, 'e1rm'), [sessions]);
  const visible = useMemo(() => filterByPeriod(sessions, period), [sessions, period]);
  const suggestion = useMemo(() => suggestNextLoad(sessions[sessions.length - 1]), [sessions]);
  const points = useMemo(() => timeSeries(visible, tab), [visible, tab]);
  const recordDates = useMemo(() => {
    const set = new Set();
    records.events.forEach((e) => { if (e.metrics.includes(tab)) set.add(e.date); });
    return set;
  }, [records, tab]);
  const best = useMemo(() => sessions.reduce((a, s) => (!a || s.e1rm > a.e1rm ? s : a), null), [sessions]);
  const tabCfg = TABS.find((t) => t.id === tab);

  const chip = (active) => `pressable px-3.5 min-h-[40px] rounded-full text-xs font-bold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${active ? 'bg-brand text-black border-brand' : 'surface text-gray-600 dark:text-gray-300'}`;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8" role="status" aria-label="Carregando">
      <div className="max-w-3xl mx-auto space-y-4"><div className="skeleton-shimmer h-16 rounded-2xl" /><div className="grid grid-cols-2 gap-3">{[0, 1].map((i) => <div key={i} className="skeleton-shimmer h-24 rounded-3xl" />)}</div><div className="skeleton-shimmer h-64 rounded-3xl" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8 pb-32">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4 animate-fade-up">
          <button onClick={() => navigate(-1)} aria-label="Voltar"
            className="pressable w-11 h-11 shrink-0 surface !rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Evolução</p>
            <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white leading-tight break-words">{cleanName}</h1>
          </div>
        </div>

        {error ? <ErrorState message="Não foi possível carregar seu histórico." />
          : sessions.length === 0 ? (
            <EmptyState icon={BarChart2} title="Sem dados suficientes" description="Conclua treinos com este exercício para gerar os gráficos." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-brand to-[#FF9800] text-black p-4 rounded-3xl shadow-lg shadow-brand/20 animate-scale-in">
                  <p className="text-[10px] font-black opacity-80 uppercase flex items-center gap-1"><Trophy className="w-3 h-3" aria-hidden="true" />Recorde atual (PR)</p>
                  <p className="text-3xl font-black">{records.weight ? `${dec(records.weight.value)} kg` : '-'}</p>
                  {records.weight && <p className="text-[11px] font-semibold opacity-80">em {formatDate(records.weight.date, { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                </div>
                <div className="surface p-4 animate-scale-in" style={{ animationDelay: '80ms' }}>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">1RM estimado</p>
                  <p className="text-3xl font-black text-gray-800 dark:text-white">{records.e1rm ? `${dec(records.e1rm.value)} kg` : '-'}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{sessions.length} treino{sessions.length > 1 ? 's' : ''}</p>
                </div>
              </div>

              <section className="surface p-4 animate-fade-up" aria-label="Gráfico de evolução">
                <div role="tablist" aria-label="Métrica" className="flex gap-2 overflow-x-auto pb-1">
                  {TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} className={chip(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
                  ))}
                </div>
                <div className="flex gap-2 my-3" role="group" aria-label="Período">
                  {PERIODS.map((p) => <button key={p.id} type="button" aria-pressed={period === p.id} className={chip(period === p.id)} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
                </div>
                {points.length === 0 ? (
                  <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Sem treinos com este dado no período.</p>
                ) : (
                  <ExerciseChart key={`${tab}-${period}`} points={points} unit={tabCfg.unit} label={tabCfg.label} recordDates={recordDates} />
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1"><Trophy className="w-3 h-3 text-brand" aria-hidden="true" />Círculos destacados marcam recordes.</p>
              </section>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="surface p-4">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase flex items-center gap-1"><Target className="w-3 h-3" aria-hidden="true" />Melhor série</p>
                  <p className="text-xl font-black text-gray-800 dark:text-white">{best?.bestSet ? `${dec(best.bestSet.weight)} kg x ${best.bestSet.reps}` : '-'}</p>
                  {best && <p className="text-[11px] text-gray-500 dark:text-gray-400">{formatDate(best.date, { day: '2-digit', month: 'short' })}</p>}
                </div>
                <div className="surface p-4">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase flex items-center gap-1"><TrendingUp className="w-3 h-3" aria-hidden="true" />Tendência mensal</p>
                  <p className="text-xl font-black text-gray-800 dark:text-white"><TrendBadge trend={trend} showLabel /></p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{trend.enough ? `Baseada nos últimos ${trend.points} treinos (1RM).` : 'Precisa de 3 treinos para calcular.'}</p>
                </div>
                <div className="surface p-4 border-brand/40">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase flex items-center gap-1"><Lightbulb className="w-3 h-3" aria-hidden="true" />Próxima carga</p>
                  {suggestion ? (
                    <>
                      <p className="text-xl font-black text-amber-600 dark:text-brand">{dec(suggestion.weight)} kg</p>
                      <p className="text-[11px] text-gray-600 dark:text-gray-300">{suggestion.reason}</p>
                    </>
                  ) : <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Sem carga registrada para sugerir.</p>}
                </div>
              </div>

              <section aria-label="Histórico por sessão">
                <h2 className="font-bold text-gray-800 dark:text-white mb-3">Histórico por sessão</h2>
                <div className="surface overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Histórico de {cleanName}: data, séries, melhor série e volume por sessão</caption>
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-gray-500 dark:text-gray-400">
                        <th scope="col" className="p-3">Data</th><th scope="col" className="p-3">Séries</th>
                        <th scope="col" className="p-3">Melhor</th><th scope="col" className="p-3 text-right">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-100">
                      {[...sessions].reverse().map((s) => (
                        <tr key={s.date} className="border-t border-gray-200/60 dark:border-white/10">
                          <th scope="row" className="p-3 font-semibold text-left whitespace-nowrap">{formatDate(s.date, { day: '2-digit', month: 'short', year: '2-digit' })}</th>
                          <td className="p-3">{s.sets.length}</td>
                          <td className="p-3 whitespace-nowrap">{dec(s.bestSet.weight)} kg x {s.bestSet.reps}</td>
                          <td className="p-3 text-right whitespace-nowrap">{formatTonnage(s.volume)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
      </div>
    </div>
  );
}
