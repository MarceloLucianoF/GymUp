import React, { useId, useMemo, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { formatDate } from '../../utils/format';

const W = 320;
const H = 180;
const PAD = { l: 34, r: 12, t: 16, b: 26 };

const fmt = (v, unit) => `${Number.isInteger(v) ? v : v.toFixed(1).replace('.', ',')}${unit}`;

// Gráfico de linha/área em SVG. points: [{date, ts, value}], recordDates: Set de ISO.
export default function ExerciseChart({ points = [], unit = 'kg', label = 'Carga', recordDates = new Set() }) {
  const gid = useId();
  const wrapRef = useRef(null);
  const [active, setActive] = useState(null);

  const geo = useMemo(() => {
    if (!points.length) return null;
    const vals = points.map((p) => p.value);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) { min = Math.max(0, min * 0.9); max = max * 1.1 || 1; }
    const pad = (max - min) * 0.1;
    min = Math.max(0, min - pad);
    max += pad;
    const t0 = points[0].ts;
    const span = points[points.length - 1].ts - t0;
    const x = (p, i) => (points.length === 1 ? (PAD.l + W - PAD.r) / 2
      : PAD.l + ((span ? (p.ts - t0) / span : i / (points.length - 1)) * (W - PAD.l - PAD.r)));
    const y = (v) => H - PAD.b - ((v - min) / (max - min)) * (H - PAD.t - PAD.b);
    const coords = points.map((p, i) => [x(p, i), y(p.value)]);
    const line = coords.map(([cx, cy], i) => `${i ? 'L' : 'M'}${cx.toFixed(1)},${cy.toFixed(1)}`).join(' ');
    const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H - PAD.b} L${coords[0][0].toFixed(1)},${H - PAD.b} Z`;
    const ticks = [min, (min + max) / 2, max];
    const xi = points.length < 3 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
    return { coords, line, area, ticks, y, xi, max, min };
  }, [points]);

  if (!geo) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const maxPoint = points.reduce((a, b) => (b.value > a.value ? b : a));
  const summary = `Gráfico de ${label.toLowerCase()}: ${points.length} treinos de ${formatDate(first.date, { day: '2-digit', month: 'long' })} a ${formatDate(last.date, { day: '2-digit', month: 'long' })}. Primeiro valor ${fmt(first.value, unit)}, último ${fmt(last.value, unit)}, máximo ${fmt(maxPoint.value, unit)}. Veja a tabela abaixo para os detalhes.`;

  const onMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    geo.coords.forEach(([cx], i) => { if (Math.abs(cx - px) < Math.abs(geo.coords[best][0] - px)) best = i; });
    setActive(best);
  };

  const a = active !== null ? { p: points[active], c: geo.coords[active] } : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ touchAction: 'pan-y' }}
      onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label={summary}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFC107" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFC107" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />
            <text x={PAD.l - 4} y={geo.y(t) + 3} textAnchor="end" fontSize="9" className="fill-gray-500 dark:fill-gray-400">{Math.round(t)}</text>
          </g>
        ))}
        {geo.xi.map((i) => (
          <text key={i} x={geo.coords[i][0]} y={H - 8} fontSize="9" textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'}
            className="fill-gray-500 dark:fill-gray-400">{formatDate(points[i].date, { day: '2-digit', month: 'short' })}</text>
        ))}
        {points.length > 1 && <path d={geo.area} fill={`url(#${gid})`} />}
        {points.length > 1 && (
          <path d={geo.line} fill="none" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            pathLength="1" strokeDasharray="1" style={{ '--len': 1 }} className="animate-draw" />
        )}
        {geo.coords.map(([cx, cy], i) => (
          <g key={i}>
            {recordDates.has(points[i].date) && <circle cx={cx} cy={cy} r="7" fill="none" stroke="#FFC107" strokeWidth="1.5" strokeOpacity="0.6" />}
            <circle cx={cx} cy={cy} r={active === i ? 5 : 3} fill="#FFC107" stroke="white" strokeWidth="1.5" />
          </g>
        ))}
        {a && <line x1={a.c[0]} x2={a.c[0]} y1={PAD.t} y2={H - PAD.b} stroke="#FFC107" strokeOpacity="0.5" strokeDasharray="2 2" />}
      </svg>
      {a && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl bg-gray-900 text-white text-xs px-2.5 py-1.5 shadow-lg whitespace-nowrap z-10"
          style={{ left: `${Math.min(88, Math.max(12, (a.c[0] / W) * 100))}%`, top: `${(a.c[1] / H) * 100}%`, marginTop: -10 }}>
          <span className="font-bold">{fmt(a.p.value, unit)}</span>
          <span className="text-gray-300"> · {formatDate(a.p.date, { day: '2-digit', month: 'short' })}</span>
          {recordDates.has(a.p.date) && <Trophy className="inline w-3 h-3 ml-1 text-brand" aria-label="Recorde" />}
        </div>
      )}
    </div>
  );
}
