import React, { useEffect, useMemo, useState } from 'react';
import { muscleFrequency } from '../../utils/analytics';
import { formatTonnage } from '../../utils/format';

// Barras horizontais de volume por grupo muscular. Passe `checkIns` (calcula) ou `data` ([{group, volume, sessions}]).
export default function MuscleBalance({ checkIns, data, days = 30, title = 'Equilíbrio muscular', className = '' }) {
  const rows = useMemo(() => data || muscleFrequency(checkIns, days), [data, checkIns, days]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(1, ...rows.map((r) => r.volume));

  return (
    <section className={`surface p-4 ${className}`} aria-label={`${title}, últimos ${days} dias`}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-bold text-gray-800 dark:text-white">{title}</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">últimos {days} dias</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sem treinos no período.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.group}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-700 dark:text-gray-200">{r.group}</span>
                <span className="text-gray-500 dark:text-gray-400">{formatTonnage(r.volume)} · {r.sessions}x</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700/60 overflow-hidden" role="presentation">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-[#FF9800] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: ready ? `${Math.max(3, (r.volume / max) * 100)}%` : '0%' }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
