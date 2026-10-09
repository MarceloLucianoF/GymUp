import React from 'react';
import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';

// Card de métrica: ícone, valor animado, rótulo, tendência e sparkline opcional.
export default function StatCard({ icon: Icon, label, value, decimals = 0, prefix, suffix, trend, spark, accent = 'brand', className = '' }) {
  const accents = {
    brand: 'bg-brand/15 text-brand',
    green: 'bg-emerald-500/15 text-emerald-500',
    red: 'bg-rose-500/15 text-rose-500',
    blue: 'bg-sky-500/15 text-sky-500'
  };
  return (
    <div className={`surface surface-hover p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${accents[accent] || accents.brand}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        {trend != null && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${trend >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
        {typeof value === 'number' ? <AnimatedNumber value={value} decimals={decimals} prefix={prefix} suffix={suffix} /> : value}
      </p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      {spark && <Sparkline data={spark} width={140} height={32} className="mt-3 w-full" />}
    </div>
  );
}
