import React, { useId } from 'react';
import { BRAND } from '../../config/brand';

// Monograma "B": a haste do B sobe e vira a ponta da seta de evolução (linhas conectadas).
// Os bojos herdam a cor do texto; a haste faz degradê do texto para o amarelo da marca.
export const BrandMark = ({ className = 'w-10 h-10' }) => {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={BRAND.name}>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="30" y1="82" x2="30" y2="14">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="0.55" stopColor="#FFD54F" />
          <stop offset="1" stopColor="#FFB300" />
        </linearGradient>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8.5">
        <path d="M 30 35 H 50 a 10.5 10.5 0 0 1 0 21 H 30" stroke="currentColor" />
        <path d="M 30 56 H 53 a 12 12 0 0 1 0 24 H 30" stroke="currentColor" />
        <path d="M 30 80 L 30 15" stroke={`url(#${gradientId})`} />
        <path d="M 21 24 L 30 13 L 39 24" stroke="#FFB300" />
      </g>
    </svg>
  );
};

// "BOH" na cor do texto + "TREINAR" na cor da marca.
export const BrandWordmark = ({ className = '' }) => (
  <span className={className}>
    BOH<span className="text-amber-600 dark:text-brand">TREINAR</span>
  </span>
);
