import React from 'react';
import { BRAND } from '../../config/brand';

// Monograma "B" com seta de evolução; herda a cor do texto, seta sempre na cor da marca.
export const BrandMark = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={BRAND.name}>
    <path d="M 32 20 L 32 80" stroke="currentColor" strokeWidth="9" strokeLinecap="round" fill="none" />
    <path d="M 32 20 H 52 a 15 15 0 0 1 0 30 H 32" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M 32 50 H 56 a 15 15 0 0 1 0 30 H 32" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M 85 70 L 85 32" stroke="#FFC107" strokeWidth="9" strokeLinecap="round" fill="none" />
    <path d="M 75 42 L 85 31 L 95 42" stroke="#FFB300" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// "BOH" na cor do texto + "TREINAR" na cor da marca.
export const BrandWordmark = ({ className = '' }) => (
  <span className={className}>
    BOH<span className="text-amber-600 dark:text-brand">TREINAR</span>
  </span>
);
