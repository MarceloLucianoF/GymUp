import React from 'react';

// Esqueleto de página com shimmer: cabeçalho, linha de cards e bloco grande.
export default function PageSkeleton({ cards = 4 }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-4">
      <div className="skeleton-shimmer h-9 w-2/3 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => <div key={i} className="skeleton-shimmer h-28 rounded-3xl" />)}
      </div>
      <div className="skeleton-shimmer h-56 rounded-3xl" />
    </div>
  );
}
