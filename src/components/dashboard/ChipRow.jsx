import React from 'react';

// Chips de filtro com rolagem horizontal e snap. options: [{ value, label }]
export default function ChipRow({ options, value, onChange, label = 'Filtros' }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar scroll-snap-x -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            style={{ scrollSnapAlign: 'start' }}
            className={`pressable min-h-[44px] shrink-0 whitespace-nowrap rounded-2xl border px-5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              active
                ? 'border-transparent bg-gradient-to-r from-brand to-[#FF9800] text-black shadow-lg shadow-brand/20'
                : 'border-gray-200 bg-white text-gray-600 hover:border-brand/40 dark:border-brand/10 dark:bg-[#1F2937]/50 dark:text-gray-300'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
