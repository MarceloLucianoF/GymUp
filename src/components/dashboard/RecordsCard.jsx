import React from 'react';
import { Link } from 'react-router-dom';
import { Medal, ChevronRight } from 'lucide-react';
import { daysAgoLabel } from '../../utils/records';

// Recordes de carga dos últimos 14 dias (só aparece quando há).
export default function RecordsCard({ records }) {
  if (!records || records.length === 0) return null;
  return (
    <section className="surface p-5" aria-label="Recordes recentes">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
        <Medal className="h-4 w-4 text-brand" aria-hidden="true" /> Novos recordes
      </h2>
      <ul className="space-y-2">
        {records.map((r) => (
          <li key={r.exercise} className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-sm font-black text-emerald-800 dark:text-emerald-300">+{Math.round((r.weight - r.previous) * 10) / 10}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{r.exercise}: {r.weight} kg</span>
              <span className="block text-xs text-gray-700 dark:text-gray-300">Antes {r.previous} kg · {daysAgoLabel(r.date)}</span>
            </span>
          </li>
        ))}
      </ul>
      <Link to="/analytics" className="pressable mt-3 inline-flex min-h-[44px] items-center gap-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-brand">
        Ver evolução por exercício <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
