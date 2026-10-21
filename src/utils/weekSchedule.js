// "Hoje na sua semana": a semana montada pela IA grava cada dia como treino pessoal "Semana · Seg · Peito e Tríceps". Daqui sai qual
// treino é o de hoje, o que já foi feito nesta semana, o que ficou atrasado e qual é o próximo. Nada é gravado: só leitura.
import { DAY_LABELS, DAY_SHORT } from './weekPlan';
import { toDate } from './analytics';

const PREFIX = /^Semana\s*·\s*(Seg|Ter|Qua|Qui|Sex|Sáb|Dom)\s*·\s*(.+)$/;

export function parsePlanned(workout) {
  const m = PREFIX.exec(String(workout?.name || ''));
  if (!m) return null;
  const weekday = DAY_SHORT.indexOf(m[1]);
  return weekday < 0 ? null : { weekday, label: m[2].trim(), workout, id: workout.id || workout.docId };
}

/** Segunda = 0 ... domingo = 6, no fuso local. */
export const weekdayIndex = (date) => (new Date(date).getDay() + 6) % 7;
const weekStart = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - weekdayIndex(d)); return d.getTime(); };

/**
 * Estado da semana. `mine`: treinos pessoais (com id "my_..."); `history`: check-ins (qualquer ordem).
 * Devolve null se não há semana montada. `done` é por treino (id) feito de segunda até agora.
 */
export function weekStatus({ mine = [], history = [], now = Date.now() }) {
  const planned = mine.map(parsePlanned).filter(Boolean).sort((a, b) => a.weekday - b.weekday);
  if (!planned.length) return null;
  const start = weekStart(now);
  const todayIdx = weekdayIndex(now);
  const doneIds = new Set((history || []).filter((h) => { const d = toDate(h?.date); return d && d.getTime() >= start && d.getTime() <= now + 60_000; }).map((h) => h.trainingId));
  const items = planned.map((p) => ({ ...p, done: doneIds.has(p.id), dayLabel: DAY_LABELS[p.weekday] }));
  const today = items.find((i) => i.weekday === todayIdx) || null;
  const doneToday = !!today?.done;
  const overdue = items.filter((i) => i.weekday < todayIdx && !i.done);
  const upcoming = items.filter((i) => i.weekday > todayIdx && !i.done);
  const next = (today && !today.done ? null : upcoming[0]) || null;
  const allDone = items.every((i) => i.done);
  return { items, today, doneToday, overdue, next, allDone, todayIdx, doneCount: items.filter((i) => i.done).length, total: items.length };
}
