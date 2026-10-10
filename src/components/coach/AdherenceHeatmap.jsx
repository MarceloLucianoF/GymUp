import React from 'react';

const CELL = 12;
const GAP = 3;

// Heatmap de 4 semanas (linhas) x 7 dias (colunas) em SVG. `grid` vem de adherenceGrid().
export default function AdherenceHeatmap({ grid, size = 'md', label = 'Treinos nas últimas 4 semanas' }) {
  const scale = size === 'sm' ? 0.75 : 1;
  const step = (CELL + GAP);
  const width = 7 * step - GAP;
  const height = grid.length * step - GAP;
  const total = grid.flat().filter((c) => c.count > 0).length;
  return (
    <svg role="img" aria-label={`${label}: ${total} dia${total === 1 ? '' : 's'} com treino`}
      width={width * scale} height={height * scale} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      {grid.map((week, w) => week.map((cell, d) => (
        <rect key={`${w}-${d}`} x={d * step} y={w * step} width={CELL} height={CELL} rx={3}
          className={cell.count === 0 ? 'fill-gray-200 dark:fill-white/10' : cell.count === 1 ? 'fill-brand' : 'fill-orange-500'}>
          <title>{`${cell.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: ${cell.count} treino${cell.count === 1 ? '' : 's'}`}</title>
        </rect>
      )))}
    </svg>
  );
}
