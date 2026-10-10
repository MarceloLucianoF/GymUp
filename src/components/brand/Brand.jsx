import React from 'react';
import { BRAND } from '../../config/brand';

// Ícone da marca: três setas empilhadas ("degraus"), igual ao favicon e ao ícone do app.
export const BrandMark = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={BRAND.name}>
    <rect width="100" height="100" rx="22" fill="#FFC21A" />
    <g fill="none" stroke="#121418" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="28,46 50,24 72,46" />
      <polyline points="28,64 50,42 72,64" strokeOpacity="0.6" />
      <polyline points="28,82 50,60 72,82" strokeOpacity="0.3" />
    </g>
  </svg>
);

// "BOH" na cor do texto + "TREINAR" na cor da marca.
export const BrandWordmark = ({ className = '' }) => (
  <span className={className}>
    BOH<span className="text-amber-600 dark:text-brand">TREINAR</span>
  </span>
);
