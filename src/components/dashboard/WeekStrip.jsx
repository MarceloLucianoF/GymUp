import React from 'react';
import { Check } from 'lucide-react';

const LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const FULL = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const sameDay = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

// Dias úteis da semana corrente (segunda a domingo) com marcação dos dias treinados.
export const getWeekDays = (history = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const trained = history.some((h) => {
      if (!h.date) return false;
      const d = new Date(h.date);
      return !Number.isNaN(d.getTime()) && sameDay(d, date);
    });
    return { date, trained, isToday: sameDay(date, today), isFuture: date > today, label: LABELS[i], full: FULL[i] };
  });
};

export default function WeekStrip({ days }) {
  return (
    <ul className="grid grid-cols-7 gap-1.5 sm:gap-3" aria-label="Treinos da semana">
      {days.map((d, i) => (
        <li key={d.full} className="flex flex-col items-center gap-1.5" style={{ animationDelay: `${i * 60}ms` }}>
          <span className={`text-[11px] font-bold ${d.isToday ? 'text-brand' : 'text-gray-500 dark:text-gray-400'}`}>{d.label}</span>
          <span
            role="img"
            aria-label={`${d.full}${d.trained ? ': treinou' : d.isFuture ? '' : ': sem treino'}${d.isToday ? ' (hoje)' : ''}`}
            className={`flex h-10 w-full max-w-[44px] items-center justify-center rounded-2xl text-xs font-black animate-scale-in ${
              d.trained
                ? 'bg-gradient-to-br from-brand to-[#FF9800] text-black shadow-md shadow-brand/30'
                : d.isToday
                  ? 'border-2 border-dashed border-brand text-brand'
                  : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500'
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {d.trained ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" /> : d.date.getDate()}
          </span>
        </li>
      ))}
    </ul>
  );
}
