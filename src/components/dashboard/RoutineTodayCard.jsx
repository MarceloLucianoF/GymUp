import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ListOrdered, Play } from 'lucide-react';

// Card "Minha ficha" da Home: o próximo treino da sequência (A, B, C...) montada pelo aluno, ou o do dia marcado.
// `status` vem de routineNext (utils/routine).
export default function RoutineTodayCard({ status, onStart }) {
  if (!status) return null;
  const { items, target, mode, last, trainedToday } = status;
  const name = target.workout?.name || 'Treino';
  const info = `${target.workout?.exercises?.length || 0} exercícios${target.workout?.estimatedTime ? ` · ${target.workout.estimatedTime}` : ''}`;

  let badge = 'Sua ficha'; let title; let sub; let cta = 'Começar';
  if (mode === 'today') { badge = 'Hoje na sua ficha'; title = `Hoje: Treino ${target.letter}`; sub = `${name} · ${info}`; }
  else if (mode === 'start') { title = `Comece pelo Treino ${target.letter}`; sub = `${name} · ${info}`; }
  else if (mode === 'day') {
    badge = trainedToday ? 'Treino de hoje feito' : 'Dia de descanso';
    title = `Próximo: ${target.dayLabel} · Treino ${target.letter}`; sub = `${name} · ${info}`; cta = 'Adiantar';
  } else {
    if (trainedToday) { badge = 'Treino de hoje feito'; cta = 'Adiantar'; }
    title = `Próximo: Treino ${target.letter}`;
    sub = `${name}${last ? ` · depois do Treino ${last.letter}` : ''}`;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#FFB300] to-[#FF9800] p-5 text-black shadow-xl shadow-brand/20 sm:p-7" aria-label="Minha ficha">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"><ListOrdered className="h-3 w-3" aria-hidden="true" />{badge}</span>
        <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{items.filter((i) => i.doneWeek).length} de {items.length} na semana</span>
      </div>
      <h2 className="font-display text-2xl font-black leading-tight sm:text-4xl">{title}</h2>
      <p className="mt-1.5 max-w-lg text-sm text-black/75">{sub}</p>

      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Treinos da ficha">
        {items.map((it) => {
          const isTarget = it.workoutId === target.workoutId;
          return (
            <li
              key={it.workoutId}
              className={`flex h-11 min-w-[44px] flex-col items-center justify-center rounded-xl px-2 text-xs font-black ${it.doneWeek ? 'bg-black text-brand' : 'bg-black/15'} ${isTarget ? 'ring-2 ring-black' : ''}`}
              aria-label={`Treino ${it.letter}: ${it.workout?.name || ''}${it.dayLabel ? `, ${it.dayLabel.toLowerCase()}` : ''}${it.doneWeek ? ', feito nesta semana' : ''}${isTarget ? ', próximo' : ''}`}
            >
              {it.letter}
              {it.doneWeek ? <Check className="h-3 w-3" aria-hidden="true" /> : <span className="text-[9px] font-bold">{it.dayLabel ? it.dayLabel.slice(0, 3) : ''}</span>}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={() => onStart(target.id)} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 text-base font-black text-brand transition-transform active:scale-95 sm:w-auto sm:px-8">
          <Play className="h-5 w-5 shrink-0 fill-current" aria-hidden="true" /><span className="truncate">{cta}: Treino {target.letter}</span>
        </button>
        <Link to="/trainings" className="flex min-h-[44px] items-center justify-center rounded-xl bg-black/10 px-4 text-xs font-black">Organizar ficha</Link>
      </div>
    </div>
  );
}
