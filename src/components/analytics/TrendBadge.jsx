import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const CFG = {
  subindo: { Icon: ArrowUpRight, cls: 'text-emerald-600 dark:text-emerald-400', text: 'Subindo' },
  caindo: { Icon: ArrowDownRight, cls: 'text-red-600 dark:text-red-400', text: 'Caindo' },
  estavel: { Icon: Minus, cls: 'text-gray-500 dark:text-gray-400', text: 'Estável' },
};

export default function TrendBadge({ trend, showLabel = false }) {
  const c = CFG[trend?.direction] || CFG.estavel;
  const pct = trend?.enough ? `${trend.percentPerMonth > 0 ? '+' : ''}${String(trend.percentPerMonth).replace('.', ',')}%` : '';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${c.cls}`} aria-label={`Tendência ${c.text.toLowerCase()} ${pct}`}>
      <c.Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {showLabel && c.text} {pct}
    </span>
  );
}
