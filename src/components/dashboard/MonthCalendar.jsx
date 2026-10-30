import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/format';
import { dayKeyOf } from '../../utils/historyFilters';

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Calendário do mês com os dias treinados. Com `onSelectDay`, os dias com treino viram botões:
 * tocar filtra a lista daquele dia; tocar de novo no mesmo dia limpa o filtro.
 */
export default function MonthCalendar({ history, selectedDay = null, onSelectDay }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const month = cursor.getMonth();
  const year = cursor.getFullYear();
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();

  const counts = useMemo(() => {
    const map = new Map();
    (history || []).forEach((h) => {
      const k = dayKeyOf(h.date);
      if (k) map.set(k, (map.get(k) || 0) + 1);
    });
    return map;
  }, [history]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))];
  const trainedInMonth = cells.filter((d) => d && counts.has(dayKeyOf(d))).length;
  const todayKey = dayKeyOf(today);
  const go = (delta) => setCursor(new Date(year, month + delta, 1));
  const monthLabel = formatDate(cursor, { month: 'long', year: 'numeric' });

  return (
    <section className="surface p-3 sm:p-6 animate-fade-up" aria-label="Calendário de treinos">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(-1)} aria-label="Mês anterior" className="pressable flex h-11 w-11 items-center justify-center rounded-2xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800 first-letter:uppercase dark:text-white" aria-live="polite">{monthLabel}</h2>
        <button type="button" onClick={() => go(1)} disabled={isCurrentMonth} aria-label="Próximo mês" className="pressable flex h-11 w-11 items-center justify-center rounded-2xl text-gray-700 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-200 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {WEEK.map((d, i) => (
          <div key={i} className="py-1 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400" aria-hidden="true">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`v${i}`} />;
          const key = dayKeyOf(date);
          const n = counts.get(key) || 0;
          const isTrained = n > 0;
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          const label = `${formatDate(date, { day: 'numeric', month: 'long' })}${isTrained ? `: ${n} ${n === 1 ? 'treino' : 'treinos'}` : ': sem treino'}${isToday ? ' (hoje)' : ''}`;
          const cls = `flex aspect-square min-h-[44px] w-full items-center justify-center rounded-xl text-xs font-bold transition-all ${
            isTrained ? 'bg-gradient-to-br from-brand to-[#FF9800] text-black shadow-md shadow-brand/30' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400'
          } ${isToday && !isTrained ? 'border-2 border-brand text-amber-700 dark:text-brand' : ''} ${isSelected ? 'ring-2 ring-gray-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-[#0B0F19]' : ''}`;
          if (isTrained && onSelectDay) {
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${label}. ${isSelected ? 'Tocar para ver todos' : 'Tocar para ver só este dia'}`}
                onClick={() => onSelectDay(isSelected ? null : key)}
                className={`pressable ${cls} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
              >
                {isSelected ? date.getDate() : <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
              </button>
            );
          }
          return (
            <div key={key} role="img" aria-label={label} className={cls}>
              {isTrained ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : date.getDate()}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-gray-600 dark:text-gray-400">
        {isCurrentMonth ? 'Você treinou' : 'Treinou'} <strong>{trainedInMonth} {trainedInMonth === 1 ? 'dia' : 'dias'}</strong> {isCurrentMonth ? 'este mês' : 'neste mês'}
        {onSelectDay && trainedInMonth > 0 ? '. Toque num dia para ver o treino.' : '.'}
      </p>
    </section>
  );
}
