// "Minha ficha": a ordem (A, B, C...) em que o aluno usa os próprios treinos e, se quiser, o dia da semana de cada um.
// Daqui saem a ordem de "Meus treinos" e o próximo treino da sequência na Home. Só cálculo: nada é gravado.
import { DAY_LABELS } from './weekPlan';
import { toDate } from './analytics';
import { weekdayIndex } from './weekSchedule';

export const ROUTINE_MAX = 30;

/** A, B, C... até Z; depois número (a ficha aceita até 30 treinos). */
export const routineLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1));

const validDay = (d) => (Number.isInteger(d) && d >= 0 && d <= 6 ? d : null);

/**
 * Itens limpos: só treinos que ainda existem (por docId), sem repetição, com dia 0 (segunda) a 6 (domingo) ou null.
 * `workouts` pode faltar (aí só limpa formato).
 */
export function normalizeRoutine(items, workouts) {
  const exists = workouts ? new Set(workouts.map((w) => w.docId)) : null;
  const seen = new Set();
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    const id = typeof it?.workoutId === 'string' ? it.workoutId : '';
    if (!id || seen.has(id) || (exists && !exists.has(id))) continue;
    seen.add(id);
    out.push({ workoutId: id, day: validDay(it.day) });
    if (out.length >= ROUTINE_MAX) break;
  }
  return out;
}

/** "Meus treinos" na ordem da ficha (com a letra); os que não estão na ficha vêm depois, na ordem em que chegaram. */
export function sortByRoutine(workouts, items) {
  const list = workouts || [];
  const pos = new Map(normalizeRoutine(items, list).map((it, i) => [it.workoutId, i]));
  const inRoutine = list.filter((w) => pos.has(w.docId)).sort((a, b) => pos.get(a.docId) - pos.get(b.docId))
    .map((w) => ({ ...w, routineIndex: pos.get(w.docId), routineLetter: routineLetter(pos.get(w.docId)) }));
  const rest = list.filter((w) => !pos.has(w.docId));
  return [...inRoutine, ...rest];
}

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * Próximo treino da ficha. `workouts`: "Meus treinos" (id "my_<docId>"); `history`: check-ins (qualquer ordem).
 * Regras:
 * - treino marcado para hoje e ainda não feito hoje → é o de hoje;
 * - todos com dia → o próximo dia marcado depois de hoje (volta para o começo da semana);
 * - senão → o seguinte ao último treino da ficha concluído (depois do último, volta ao A); sem histórico, o A.
 * Devolve null se a ficha está vazia.
 */
export function routineNext({ items, workouts = [], history = [], now = Date.now() }) {
  const byDoc = new Map(workouts.map((w) => [w.docId, w]));
  const list = normalizeRoutine(items, workouts).map((it, i) => {
    const workout = byDoc.get(it.workoutId);
    return { ...it, index: i, letter: routineLetter(i), workout, id: workout.id, dayLabel: it.day == null ? null : DAY_LABELS[it.day] };
  });
  if (!list.length) return null;

  const ids = new Map(list.map((it) => [it.id, it]));
  const todayStart = startOfDay(now);
  const todayIdx = weekdayIndex(now);
  const weekStart = todayStart - todayIdx * 86_400_000;
  let last = null; let lastAt = -Infinity;
  const doneToday = new Set(); const doneWeek = new Set();
  for (const h of history || []) {
    const it = ids.get(h?.trainingId);
    const d = toDate(h?.date);
    if (!it || !d) continue;
    const t = d.getTime();
    if (t > now + 60_000) continue;
    if (t > lastAt) { lastAt = t; last = it; }
    if (t >= todayStart) doneToday.add(it.id);
    if (t >= weekStart) doneWeek.add(it.id);
  }
  const items2 = list.map((it) => ({ ...it, doneToday: doneToday.has(it.id), doneWeek: doneWeek.has(it.id) }));
  const todayItem = items2.find((it) => it.day === todayIdx && !it.doneToday) || null;
  const allDays = items2.every((it) => it.day != null);

  let target; let mode;
  if (todayItem) { target = todayItem; mode = 'today'; }
  else if (allDays) {
    const sorted = [...items2].sort((a, b) => ((a.day - todayIdx + 7) % 7 || 7) - ((b.day - todayIdx + 7) % 7 || 7) || a.index - b.index);
    target = sorted[0]; mode = 'day';
  } else {
    target = last ? items2[(last.index + 1) % items2.length] : items2[0];
    mode = last ? 'sequence' : 'start';
  }
  return { items: items2, target, mode, last: last ? items2[last.index] : null, trainedToday: doneToday.size > 0, todayIdx };
}
