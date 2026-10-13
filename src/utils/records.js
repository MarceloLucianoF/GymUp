// Recordes de carga do aluno a partir do histórico: o treino mais recente em que a maior carga de um exercício passou da
// melhor marca anterior (só vale se já havia marca antes). Só datas, nomes de exercício e cargas.
const DAY_MS = 86_400_000;

const maxWeightByExercise = (checkIn) => {
  const out = {};
  (Array.isArray(checkIn?.exercises) ? checkIn.exercises : []).forEach((ex) => {
    const sets = Array.isArray(ex?.sets) ? ex.sets : [];
    const w = sets.reduce((m, s) => Math.max(m, Number(s?.weight) || 0), 0);
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
      if (prev !== undefined && w > prev && now - d >= 0 && (now - d) / DAY_MS <= withinDays) found[name] = { exercise: name, weight: w, previous: prev, date: d };
      if (prev === undefined || w > prev) best[name] = w;
    });
  });
  return Object.values(found).sort((a, b) => b.date - a.date).slice(0, max);
}

export const daysAgoLabel = (date, now = new Date()) => {
  const days = Math.floor((now - date) / DAY_MS);
  return days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
};
