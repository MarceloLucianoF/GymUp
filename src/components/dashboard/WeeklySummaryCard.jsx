import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';

const Stat = ({ label, value }) => (
  <div className="rounded-2xl bg-gray-50 px-3 py-2 text-center dark:bg-white/5">
    <p className="font-display text-lg font-black text-gray-900 dark:text-white">{value}</p>
    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</p>
  </div>
);

const TABS = [['current', 'Esta semana'], ['last', 'Semana passada']];

// Os números vêm de utils/weeklySummary e são os mesmos do texto; a IA só reescreve (ver weeklySummaryService).
export default function WeeklySummaryCard({ facts, narrative, period, onPeriod }) {
  const aiText = narrative.source === 'ai' || narrative.source === 'saved-ai';
  const goal = facts.goal.weekly ? `${facts.workouts}/${facts.goal.weekly}` : String(facts.workouts);
  return (
    <section className="surface p-5" aria-label="Resumo da semana">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
          <CalendarRange className="h-4 w-4 text-brand" aria-hidden="true" /> Resumo da semana
        </h2>
        <div role="group" aria-label="Período do resumo" className="flex gap-1">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={period === id} onClick={() => onPeriod(id)}
              className={`pressable min-h-[44px] rounded-xl px-3 text-xs font-bold ${period === id ? 'bg-brand text-black' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="list" aria-label="Números do período">
        <div role="listitem"><Stat label={facts.goal.weekly ? 'Treinos / meta' : 'Treinos'} value={goal} /></div>
        <div role="listitem"><Stat label="Minutos" value={facts.minutes} /></div>
        <div role="listitem"><Stat label="Volume" value={facts.texts.volume} /></div>
        <div role="listitem"><Stat label="Sequência" value={`${facts.streak} ${facts.streak === 1 ? 'dia' : 'dias'}`} /></div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-gray-800 dark:text-gray-100" data-testid="summary-text">{narrative.text}</p>

      {facts.workouts === 0 && period === 'current' && (
        <Link to="/trainings" className="pressable mt-2 inline-flex min-h-[44px] items-center text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-brand">Ver minhas fichas</Link>
      )}

      {(facts.topExercises.length > 0 || facts.records.length > 0 || facts.comparison) && (
        <ul className="mt-3 space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
          {facts.topExercises.length > 0 && <li>Mais feitos: {facts.topExercises.map((e) => `${e.name} (${e.sessions})`).join(', ')}</li>}
          {facts.records.length > 0 && <li>Recordes: {facts.records.map((r) => `${r.exercise} ${r.weight} kg (antes ${r.previous} kg)`).join(', ')}</li>}
          {facts.comparison && (
            <li className="flex items-center gap-1">
              {facts.comparison.volumePct >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />}
              Volume {facts.comparison.volumePct >= 0 ? '+' : ''}{facts.comparison.volumePct}% vs semana anterior ({facts.comparison.previousWorkouts} treino{facts.comparison.previousWorkouts === 1 ? '' : 's'})
            </li>
          )}
        </ul>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-600 dark:text-gray-400">
        <span>Semana {facts.texts.range}{facts.tz ? ` · fuso ${facts.tz}` : ''}{facts.closed ? '' : ' · em andamento'}</span>
        <span className="inline-flex items-center gap-1">
          {aiText && <Sparkles className="h-3 w-3" aria-hidden="true" />}
          {aiText ? 'Texto gerado por IA a partir dos números acima' : 'Resumo automático'}
        </span>
      </p>
    </section>
  );
}
