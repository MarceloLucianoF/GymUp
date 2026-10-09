import React from 'react';

// Abas acessíveis (role=tablist) com rolagem horizontal no mobile e setas do teclado.
export default function Tabs({ tabs, value, onChange, className = '' }) {
  const onKeyDown = (e) => {
    const idx = tabs.findIndex((t) => t.id === value);
    if (e.key === 'ArrowRight') onChange(tabs[(idx + 1) % tabs.length].id);
    if (e.key === 'ArrowLeft') onChange(tabs[(idx - 1 + tabs.length) % tabs.length].id);
  };
  return (
    <div role="tablist" aria-label="Seções" onKeyDown={onKeyDown} className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${className}`}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active}
            aria-controls={`panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`pressable min-h-[44px] shrink-0 rounded-2xl px-4 text-sm font-bold transition ${active ? 'bg-brand text-black shadow-lg shadow-brand/20' : 'bg-white/70 text-gray-600 hover:text-gray-900 dark:bg-white/5 dark:text-gray-300 dark:hover:text-white'}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
