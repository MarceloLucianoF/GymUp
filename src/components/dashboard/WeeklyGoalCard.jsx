import React from 'react';
import { Minus, Plus } from 'lucide-react';
import ProgressRing from '../ui/ProgressRing';
import WeekStrip from './WeekStrip';
import { GOAL_MIN, GOAL_MAX } from '../../hooks/useStudentHome';

// Meta semanal configurável (2 a 7 treinos).
export default function WeeklyGoalCard({ days, count, goal, onGoalChange }) {
  const pct = Math.min(100, Math.round((count / goal) * 100));
  return (
    <section className="surface p-5" aria-label="Meta semanal">
      <div className="flex items-center gap-5">
        <ProgressRing value={pct} size={88} stroke={9}>
          <p className="font-display text-xl font-black leading-none text-gray-900 dark:text-white">{count}<span className="text-xs font-bold text-gray-500">/{goal}</span></p>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">Meta semanal</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {count >= goal ? 'Meta batida! Você é imparável.' : `Faltam ${goal - count} treino(s) para fechar a semana.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center" role="group" aria-label="Ajustar meta semanal">
          <button type="button" aria-label="Aumentar meta" disabled={goal >= GOAL_MAX} onClick={() => onGoalChange(goal + 1)} className="pressable flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-200 dark:hover:bg-white/10"><Plus className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" aria-label="Diminuir meta" disabled={goal <= GOAL_MIN} onClick={() => onGoalChange(goal - 1)} className="pressable flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-200 dark:hover:bg-white/10"><Minus className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="mt-4"><WeekStrip days={days} /></div>
    </section>
  );
}
