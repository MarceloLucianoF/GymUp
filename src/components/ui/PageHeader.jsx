import React from 'react';

// Cabeçalho de página com título em gradiente, subtítulo e ações.
export default function PageHeader({ eyebrow, title, subtitle, actions, className = '' }) {
  return (
    <header className={`mb-6 flex flex-wrap items-end justify-between gap-3 animate-fade-up ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white sm:text-3xl lg:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
