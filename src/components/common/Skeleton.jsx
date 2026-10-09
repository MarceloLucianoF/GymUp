import React from 'react';

// Bloco animado. Use className para definir tamanho (ex.: "h-6 w-1/2").
export default function Skeleton({ className = 'h-4 w-full' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700/60 ${className}`} />;
}

// Lista de linhas/cartões de carregamento.
export function SkeletonList({ count = 4, itemClassName = 'h-20 w-full' }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3 p-4">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className={itemClassName} />)}
    </div>
  );
}
