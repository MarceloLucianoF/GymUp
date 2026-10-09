import React, { useId } from 'react';

// Mini gráfico de linha/área com traço animado.
export default function Sparkline({ data = [], width = 120, height = 36, className = '' }) {
  const gradientId = useId();
  const values = data.map(Number).filter(Number.isFinite);
  if (values.length < 2) return <div className={`skeleton-shimmer rounded-lg ${className}`} style={{ width, height }} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - 4 - ((v - min) / span) * (height - 8)]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFC107" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFC107" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#FFC107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ '--len': 400, strokeDasharray: 400 }} className="animate-draw" />
    </svg>
  );
}
