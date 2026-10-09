import React from 'react';
import Sparkline from '../ui/Sparkline';
import { formatTonnage } from '../../utils/format';

// Volume dos últimos 7 treinos (do mais antigo ao mais recente).
export default function VolumeTrend({ history }) {
  const values = history.slice(0, 7).map((h) => Number(h.totalVolume) || 0).reverse();
  const last = values[values.length - 1] || 0;
  return (
    <section className="surface p-5" aria-label="Volume dos últimos 7 treinos">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Volume dos últimos 7 treinos</h2>
        {values.length > 0 && <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Último: {formatTonnage(last, ' t')}</span>}
      </div>
      {values.length >= 2 ? (
        <>
          <Sparkline data={values} width={320} height={64} className="h-16 w-full" />
          <p className="sr-only">Volumes em kg: {values.join(', ')}</p>
        </>
      ) : (
        <p className="py-4 text-sm text-gray-500 dark:text-gray-400">Complete ao menos 2 treinos para ver a evolução.</p>
      )}
    </section>
  );
}
