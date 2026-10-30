import React from 'react';
import { CalendarCheck, Check, Moon, Play } from 'lucide-react';
import { DAY_SHORT } from '../../utils/weekPlan';
import { plural } from '../../utils/text';

// Card "Hoje na sua semana": usa os treinos "Semana · Seg · ..." que o aluno salvou do plano da IA.
export default function WeekTodayCard({ status, onStart }) {
  if (!status) return null;
  const { today, doneToday, next, overdue, allDone, items, todayIdx, doneCount, total } = status;
  const focus = today && !today.done ? today : null;
  const late = overdue[0] || null;

  let badge = 'Hoje na sua semana';
  let title; let sub; let target = null; let cta = 'Começar';
  if (allDone) { badge = 'Semana concluída'; title = 'Semana completa!'; sub = `Você fez ${total === 1 ? 'o treino planejado' : `os ${total} treinos planejados`}. Descanse e monte a próxima semana quando quiser.`; }
  else if (focus) { title = focus.label; sub = `${plural(focus.workout.exercises?.length || 0, 'exercício', 'exercícios')} · ${focus.workout.estimatedTime || ''}`.trim(); target = focus; }
  else if (doneToday) { badge = 'Treino de hoje feito'; title = next ? `Próximo: ${next.dayLabel} · ${next.label}` : 'Hoje já está pago'; sub = next ? 'Aproveite o descanso.' : 'Falta só repor o que ficou atrasado.'; target = next || late; cta = next ? 'Adiantar' : 'Fazer agora'; }
  else { badge = 'Dia de descanso'; title = next ? `Próximo: ${next.dayLabel} · ${next.label}` : late ? `Atrasado: ${late.label}` : 'Descanso'; sub = next ? 'Hoje não tem treino planejado.' : late ? `Era de ${late.dayLabel.toLowerCase()}; ainda dá tempo.` : 'Sem treino planejado para hoje.'; target = next || late; cta = next ? 'Adiantar' : 'Fazer agora'; }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#FFB300] to-[#FF9800] p-5 text-black shadow-xl shadow-brand/20 sm:p-7" aria-label="Hoje na sua semana">
      <div className="relative z-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"><CalendarCheck className="h-3 w-3" aria-hidden="true" />{badge}</span>
          <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{doneCount} de {total} feitos</span>
        </div>
        <h2 className="font-display text-2xl font-black leading-tight sm:text-4xl">{title}</h2>
        <p className="mt-1.5 max-w-lg text-sm text-black/75">{sub}</p>

        <ul className="mt-4 flex gap-1.5" aria-label="Dias da semana">
          {DAY_SHORT.map((d, i) => {
            const it = items.find((x) => x.weekday === i);
            return (
              <li key={d} className={`flex h-11 flex-1 flex-col items-center justify-center rounded-xl text-[10px] font-black ${it?.done ? 'bg-black text-brand' : it ? 'bg-black/15' : 'bg-black/5 text-black/50'} ${i === todayIdx ? 'ring-2 ring-black' : ''}`} aria-label={`${d}${it ? `: ${it.label}${it.done ? ', feito' : ''}` : ': descanso'}${i === todayIdx ? ', hoje' : ''}`}>
                {d}
                {it?.done ? <Check className="h-3 w-3" aria-hidden="true" /> : !it ? <Moon className="h-3 w-3 opacity-50" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-black" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>

        {late && target !== late && !allDone && (
          <button type="button" onClick={() => onStart(late.id)} className="mt-3 min-h-[44px] rounded-xl bg-black/10 px-3 text-xs font-black">Atrasado: {late.label} ({late.dayLabel.toLowerCase()}). Fazer agora</button>
        )}
        {target && (
          <button type="button" onClick={() => onStart(target.id)} className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-black text-base font-black text-brand active:scale-95 transition-transform sm:w-auto sm:px-8">
            <Play className="h-5 w-5 fill-current" aria-hidden="true" />{cta}: {target.label}
          </button>
        )}
      </div>
    </div>
  );
}
