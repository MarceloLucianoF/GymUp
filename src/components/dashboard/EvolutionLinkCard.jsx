import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ChevronRight } from 'lucide-react';
import { formatTonnage } from '../../utils/format';

/** "Ver evolução": resumo do mês em uma linha; os números completos ficam na tela Evolução. */
export default function EvolutionLinkCard({ monthCount = 0, monthVolume = 0, maxLoad = 0 }) {
  const parts = [`${monthCount} ${monthCount === 1 ? 'treino' : 'treinos'} no mês`];
  if (monthVolume > 0) parts.push(`${formatTonnage(monthVolume, ' t').replace('.', ',')} de volume`);
  if (maxLoad > 0) parts.push(`recorde ${maxLoad} kg`);
  return (
    <Link to="/measurements" className="surface surface-hover pressable flex min-h-[64px] items-center gap-4 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><TrendingUp className="h-5 w-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-black text-gray-900 dark:text-white">Ver evolução</span>
        <span className="block truncate text-xs text-gray-600 dark:text-gray-400">{parts.join(' · ')}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
    </Link>
  );
}
