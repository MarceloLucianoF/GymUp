import React, { useId } from 'react';

// Gráfico de linha SVG responsivo com área, pontos e traço animado. data: [{ label, value }].
export default function LineChart({ data = [], height = 160, unit = '', decimals = 1, ariaLabel = 'Gráfico de linha', className = '' }) {
  const gradId = useId();
  const points = data.filter((d) => Number.isFinite(Number(d.value)));
  if (points.length < 2) return null;
  const W = 320;
  const H = height;
  const pad = { l: 8, r: 8, t: 14, b: 8 };
  const values = points.map((d) => Number(d.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const line = points.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(d.value)).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${H} L${x(0)},${H} Z`;
  const fmt = (v) => `${Number(v).toFixed(decimals)}${unit}`;
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${ariaLabel}: de ${fmt(values[0])} para ${fmt(values[values.length - 1])}`} preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFC107" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFC107" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          style={{ '--len': 900, strokeDasharray: 900 }} className="animate-draw" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] font-medium text-gray-400">
        <span>{points[0].label} · <b className="text-gray-600 dark:text-gray-300">{fmt(values[0])}</b></span>
        <span>{points[points.length - 1].label} · <b className="text-gray-600 dark:text-gray-300">{fmt(values[values.length - 1])}</b></span>
      </div>
    </div>
  );
}
