import React from 'react';
import { Award, Lock } from 'lucide-react';

// Selos de conquistas rápidas.
export default function AchievementBadges({ achievements }) {
  return (
    <section className="surface p-5" aria-label="Conquistas">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Conquistas</h2>
      <ul className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {achievements.map((a) => (
          <li key={a.id} className="flex w-20 shrink-0 flex-col items-center text-center" title={a.hint}>
            <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${a.unlocked ? 'border-brand bg-brand/15 text-brand' : 'border-gray-300 bg-gray-100 text-gray-400 dark:border-white/10 dark:bg-white/5'}`}>
              {a.unlocked ? <Award className="h-6 w-6" aria-hidden="true" /> : <Lock className="h-5 w-5" aria-hidden="true" />}
            </span>
            <span className={`mt-1.5 text-[11px] font-bold leading-tight ${a.unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{a.label}</span>
            <span className="sr-only">{a.unlocked ? 'Conquistado' : 'Bloqueado'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
