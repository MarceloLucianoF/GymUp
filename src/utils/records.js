// Recordes de carga do aluno a partir do histórico: o treino mais recente em que a maior carga de um exercício passou da
// melhor marca anterior (só vale se já havia marca antes). Só datas, nomes de exercício e cargas.
import { dayKey } from './consistency';
const DAY_MS = 86_400_000;
// Dias de calendário no fuso do aparelho (o mesmo usado em sequência e ranking), não blocos de 24 h.
const calendarDays = (from, to) => Math.round((new Date(`${dayKey(to)}T12:00:00`) - new Date(`${dayKey(from)}T12:00:00`)) / DAY_MS);

const maxWeightByExercise = (checkIn) => {
  const out = {};
  (Array.isArray(checkIn?.exercises) ? checkIn.exercises : []).forEach((ex) => {
    const sets = Array.isArray(ex?.sets) ? ex.sets : [];
    // Só séries concluídas (o check-in só guarda concluídas, mas uma marcada como não concluída nunca vale).
    const w = sets.reduce((m, s) => (s?.completed === false ? m : Math.max(m, Number(s?.weight) || 0)), 0);
    if (ex?.name && w > 0) out[ex.name] = Math.max(out[ex.name] || 0, w);
  });
  return out;
};

const toDate = (v) => {
  const d = v?.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** [{ exercise, weight, previous, date }] mais recentes primeiro, dentro de `withinDays`. */
export function recentRecords(history = [], now = new Date(), { withinDays = 14, max = 3 } = {}) {
  const sorted = history.map((c) => ({ c, d: toDate(c.date) })).filter((x) => x.d).sort((a, b) => a.d - b.d);
  const best = {};
  const found = {};
  sorted.forEach(({ c, d }) => {
    Object.entries(maxWeightByExercise(c)).forEach(([name, w]) => {
      const prev = best[name];
      if (prev !== undefined && w > prev && d <= now && calendarDays(d, now) <= withinDays) found[name] = { exercise: name, weight: w, previous: prev, date: d };
      if (prev === undefined || w > prev) best[name] = w;
    });
  });
  return Object.values(found).sort((a, b) => b.date - a.date).slice(0, max);
}

export const daysAgoLabel = (date, now = new Date()) => {
  const days = calendarDays(date, now);
  return days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
};
