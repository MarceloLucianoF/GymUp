import React, { useState } from 'react';
import { Minus, Plus, Flame, SlidersHorizontal } from 'lucide-react';
import ProgressRing from '../ui/ProgressRing';
import WeekStrip from './WeekStrip';
import { GOAL_MIN, GOAL_MAX } from '../../hooks/useStudentHome';

const GoalButtons = ({ goal, onGoalChange, row = false }) => (
  <div className={`flex shrink-0 items-center ${row ? 'flex-row gap-1' : 'flex-col'}`} role="group" aria-label="Ajustar meta semanal">
    <button type="button" aria-label="Aumentar meta" disabled={goal >= GOAL_MAX} onClick={() => onGoalChange(goal + 1)} className="pressable flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-200 dark:hover:bg-white/10"><Plus className="h-4 w-4" aria-hidden="true" /></button>
    <button type="button" aria-label="Diminuir meta" disabled={goal <= GOAL_MIN} onClick={() => onGoalChange(goal - 1)} className="pressable flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-200 dark:hover:bg-white/10"><Minus className="h-4 w-4" aria-hidden="true" /></button>
  </div>
);

// Meta semanal configurável (2 a 7 treinos). `compact` (Home): anel menor, sequência ao lado e ajuste da meta sob demanda.
export default function WeeklyGoalCard({ days, count, goal, onGoalChange, compact = false, streak = null }) {
  const [adjusting, setAdjusting] = useState(false);
  const pct = Math.min(100, Math.round((count / goal) * 100));
  const hint = count >= goal ? 'Meta batida! Você é imparável.' : `Faltam ${goal - count} treino(s) para fechar a semana.`;

  if (compact) {
    return (
      <section className="surface p-4" aria-label="Meta semanal">
        <div className="flex items-center gap-3">
          <ProgressRing value={pct} size={56} stroke={6}>
            <p className="font-display text-sm font-black leading-none text-gray-900 dark:text-white">{count}<span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">/{goal}</span></p>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-black leading-tight text-gray-900 dark:text-white">Meta da semana</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300">{hint}</p>
          </div>
          {streak !== null && (
            <span className="flex shrink-0 flex-col items-center rounded-2xl bg-orange-500/10 px-2.5 py-1.5" aria-label={`Sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}`}>
              <Flame className={`h-5 w-5 fill-orange-500 text-orange-500 ${streak > 0 ? '' : 'opacity-50'}`} aria-hidden="true" />
              <span className="font-display text-sm font-black leading-none text-gray-900 dark:text-white" aria-hidden="true">{streak}</span>
              <span className="text-[9px] font-bold uppercase text-gray-600 dark:text-gray-400" aria-hidden="true">{streak === 1 ? 'dia' : 'dias'}</span>
            </span>
          )}
          <button
            type="button"
            aria-expanded={adjusting}
            aria-label="Ajustar meta semanal"
            onClick={() => setAdjusting((v) => !v)}
            className={`pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10 ${adjusting ? 'bg-gray-100 dark:bg-white/10' : ''}`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {adjusting && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-3 dark:bg-white/5">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{goal} treinos por semana</span>
            <GoalButtons goal={goal} onGoalChange={onGoalChange} row />
          </div>
        )}
        <div className="mt-3"><WeekStrip days={days} /></div>
      </section>
    );
  }

  return (
    <section className="surface p-5" aria-label="Meta semanal">
      <div className="flex items-center gap-5">
        <ProgressRing value={pct} size={88} stroke={9}>
          <p className="font-display text-xl font-black leading-none text-gray-900 dark:text-white">{count}<span className="text-xs font-bold text-gray-600 dark:text-gray-400">/{goal}</span></p>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">Meta semanal</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{hint}</p>
        </div>
        <GoalButtons goal={goal} onGoalChange={onGoalChange} />
      </div>
      <div className="mt-4"><WeekStrip days={days} /></div>
    </section>
  );
}
