import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/format';

const kg = (n) => `${Math.round(Number(n) || 0).toLocaleString('pt-BR')} kg`;
const signed = (n, unit = '') => {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('pt-BR')}${unit}`;
};
const tone = (n) => (n > 0 ? 'text-green-700 dark:text-green-400' : n < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400');
const Arrow = ({ n, className = 'h-4 w-4' }) => {
  const Icon = n > 0 ? TrendingUp : n < 0 ? TrendingDown : Minus;
  return <Icon className={`${className} shrink-0 ${tone(n)}`} aria-hidden="true" />;
};

/** Variação de volume e de carga por exercício em relação à sessão anterior da mesma ficha. */
export default function SessionComparison({ comparison }) {
  if (!comparison) return null;
  const { previous, volume, prevVolume, volumeDelta, volumePct } = comparison;
  const when = formatDate(previous.date, { day: 'numeric', month: 'short' });
  const prevId = previous.id || previous.firestoreId;
  const totalText = volumePct === null ? `${signed(volumeDelta)} kg` : `${signed(volumePct, '%')}`;

  return (
    <section className="surface p-4 sm:p-5" aria-label="Comparação com a sessão anterior">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Comparado com a anterior</h3>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">Mesma ficha, em {when}</p>
        </div>
        <div className="shrink-0 text-right" data-testid="volume-total">
          <p className={`flex items-center justify-end gap-1 font-display text-xl font-black ${tone(volumeDelta)}`}><Arrow n={volumeDelta} className="h-5 w-5" />{totalText}</p>
          <p className="text-[11px] text-gray-600 dark:text-gray-400">Volume {kg(prevVolume)} → {kg(volume)}</p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-gray-100 dark:divide-white/10" aria-label="Variação por exercício">
        {comparison.exercises.map((ex) => (
          <li key={`${ex.status}-${ex.name}`} className="flex min-h-[52px] items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{ex.name}</span>
              {ex.status === 'both' && (
                <span className="block text-xs text-gray-600 dark:text-gray-400">Carga {kg(ex.prevLoad)} → {kg(ex.load)}</span>
              )}
              {ex.status === 'new' && <span className="block text-xs text-gray-600 dark:text-gray-400">Não estava na sessão anterior</span>}
              {ex.status === 'removed' && <span className="block text-xs text-gray-600 dark:text-gray-400">Feito na anterior, não nesta</span>}
            </span>
            {ex.status === 'both' ? (
              <span className="flex shrink-0 flex-col items-end text-xs font-bold">
                <span className={`flex items-center gap-1 ${tone(ex.loadDelta)}`} aria-label={`Carga ${signed(ex.loadDelta, ' kg')}`}><Arrow n={ex.loadDelta} className="h-3.5 w-3.5" />{signed(ex.loadDelta, ' kg')}</span>
                <span className={tone(ex.volumeDelta)} aria-label={`Volume ${ex.volumePct === null ? signed(ex.volumeDelta, ' kg') : signed(ex.volumePct, '%')}`}>
                  vol. {ex.volumePct === null ? signed(ex.volumeDelta, ' kg') : signed(ex.volumePct, '%')}
                </span>
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">{ex.status === 'new' ? 'Novo' : 'Ficou de fora'}</span>
            )}
          </li>
        ))}
      </ul>

      {prevId && (
        <Link to={`/history/${prevId}`} className="pressable mt-2 flex min-h-[44px] items-center justify-center gap-1 rounded-2xl text-xs font-bold text-amber-800 hover:bg-gray-50 dark:text-brand dark:hover:bg-white/5">
          Abrir a sessão de {when} <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
