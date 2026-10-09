import React from 'react';

// Gráfico de barras animado (CSS). data: [{ label, value, hint? }].
export default function BarChart({ data = [], height = 140, formatValue = (v) => v, highlightLast = true, ariaLabel = 'Gráfico de barras', className = '' }) {
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 0);
  const summary = data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(', ');
  if (data.length === 0) return null;
  return (
    <div role="img" aria-label={`${ariaLabel}. ${summary}`} className={className}>
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const pct = max > 0 ? (value / max) * 100 : 0;
          const isLast = highlightLast && i === data.length - 1;
          return (
            <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${d.hint || d.label}: ${formatValue(value)}`}>
              <span className="mb-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">{value > 0 ? formatValue(value) : ''}</span>
              <div
                className={`w-full origin-bottom rounded-t-xl animate-bar-grow ${isLast ? 'bg-gradient-to-t from-brand to-amber-300' : 'bg-gradient-to-t from-brand/50 to-brand/80'} ${value === 0 ? 'opacity-30' : ''}`}
                style={{ height: `${Math.max(pct, value > 0 ? 6 : 3)}%`, animationDelay: `${i * 60}ms` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2" aria-hidden="true">
        {data.map((d, i) => (
          <span key={`${d.label}-l-${i}`} className="flex-1 truncate text-center text-[10px] font-medium uppercase text-gray-400">{d.label}</span>
        ))}
      </div>
    </div>
  );
}
