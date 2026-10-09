// Funções puras de análise de evolução por exercício (sem Firebase, sem React).
const DAY = 86400000;

export const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const raw = value?.seconds ? value.seconds * 1000 : value?.toDate ? value.toDate() : value;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round1 = (n) => Math.round(n * 10) / 10;

export const roundToHalf = (n) => Math.round(n * 2) / 2;

// Epley: w * (1 + reps/30). Séries sem carga ou sem reps retornam 0.
export const estimate1RM = (weight, reps) => {
  const w = num(weight);
  const r = num(reps);
  if (w <= 0 || r <= 0) return 0;
  return round1(w * (1 + r / 30));
};

// Séries válidas: concluídas (completed !== false) e com reps > 0.
export const validSets = (sets) =>
  (Array.isArray(sets) ? sets : [])
    .filter((s) => s && s.completed !== false && num(s.reps) > 0 && num(s.weight) >= 0)
    .map((s) => ({ weight: num(s.weight), reps: num(s.reps) }));

// Métricas de uma lista de séries de um treino.
export const sessionMetrics = (sets) => {
  const valid = validSets(sets);
  if (!valid.length) return null;
  let bestSet = null;
  let best1rm = 0;
  let volume = 0;
  let maxWeight = 0;
  let totalReps = 0;
  valid.forEach((s) => {
    const e = estimate1RM(s.weight, s.reps);
    if (!bestSet || e > best1rm || (e === best1rm && s.weight > bestSet.weight)) {
      bestSet = s;
      best1rm = e;
    }
    volume += s.weight * s.reps;
    totalReps += s.reps;
    if (s.weight > maxWeight) maxWeight = s.weight;
  });
  return { sets: valid, bestSet, e1rm: best1rm, volume: round1(volume), maxWeight, totalReps };
};

const sortedAsc = (checkIns) =>
  (Array.isArray(checkIns) ? checkIns : [])
    .map((c) => ({ c, d: toDate(c?.date) }))
    .filter((x) => x.d)
    .sort((a, b) => a.d - b.d);

// Histórico de um exercício: uma sessão por check-in, ordem cronológica.
export const buildExerciseHistory = (checkIns, exerciseName) => {
  const out = [];
  sortedAsc(checkIns).forEach(({ c, d }) => {
    const list = Array.isArray(c.exercises) ? c.exercises : [];
    const matches = list.filter((ex) => ex && ex.name === exerciseName);
    if (!matches.length) return;
    const m = sessionMetrics(matches.flatMap((ex) => (Array.isArray(ex.sets) ? ex.sets : [])));
    if (m) out.push({ date: d.toISOString(), ts: d.getTime(), muscleGroup: matches[0].muscleGroup || null, ...m });
  });
  return out;
};

// Todos os exercícios executados -> { name, muscleGroup, sessions }.
export const groupExercises = (checkIns) => {
  const names = new Map();
  (Array.isArray(checkIns) ? checkIns : []).forEach((c) => {
    (Array.isArray(c?.exercises) ? c.exercises : []).forEach((ex) => {
      if (ex?.name && !names.has(ex.name)) names.set(ex.name, ex.muscleGroup || null);
    });
  });
  return [...names.entries()]
    .map(([name, muscleGroup]) => ({ name, muscleGroup, sessions: buildExerciseHistory(checkIns, name) }))
    .filter((e) => e.sessions.length > 0);
};

// Séries temporais [{date, ts, value}] para 'weight' | 'e1rm' | 'volume'.
export const METRIC_KEY = { weight: 'maxWeight', e1rm: 'e1rm', volume: 'volume' };
export const timeSeries = (sessions, metric = 'e1rm') => {
  const key = METRIC_KEY[metric] || metric;
  return (sessions || [])
    .map((s) => ({ date: s.date, ts: s.ts, value: num(s[key]) }))
    .filter((p) => p.value > 0);
};

// Recordes: valor e data do melhor de cada métrica; eventsByIndex marca sessões que bateram recorde.
export const detectRecords = (sessions) => {
  const result = { weight: null, e1rm: null, volume: null, events: [] };
  const best = { weight: 0, e1rm: 0, volume: 0 };
  (sessions || []).forEach((s, idx) => {
    const flags = [];
    Object.keys(best).forEach((metric) => {
      const v = num(s[METRIC_KEY[metric]]);
      if (v > best[metric]) {
        if (idx > 0 && best[metric] > 0) flags.push(metric);
        best[metric] = v;
        result[metric] = { value: v, date: s.date };
      }
    });
    if (flags.length) result.events.push({ date: s.date, index: idx, metrics: flags });
  });
  return result;
};

// Há recorde (não-inaugural) nos últimos `days` dias?
export const hasRecentRecord = (records, days = 14, now = new Date()) => {
  const limit = now.getTime() - days * DAY;
  return (records?.events || []).some((e) => {
    const d = toDate(e.date);
    return d && d.getTime() >= limit;
  });
};

// Tendência por regressão linear dos últimos N treinos (x em dias).
export const computeTrend = (sessions, metric = 'e1rm', lastN = 8) => {
  const pts = timeSeries(sessions, metric).slice(-lastN);
  const base = { direction: 'estavel', percentPerMonth: 0, slopePerDay: 0, points: pts.length, enough: false };
  if (pts.length < 3) return base;
  const x0 = pts[0].ts;
  const xs = pts.map((p) => (p.ts - x0) / DAY);
  const ys = pts.map((p) => p.value);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (sxx === 0 || my === 0) return { ...base, enough: true };
  const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const slope = sxy / sxx;
  const percentPerMonth = round1(((slope * 30) / my) * 100);
  const direction = percentPerMonth >= 1 ? 'subindo' : percentPerMonth <= -1 ? 'caindo' : 'estavel';
  return { direction, percentPerMonth, slopePerDay: slope, points: n, enough: true };
};

export const filterByPeriod = (sessions, days, now = new Date()) => {
  if (!days) return sessions || [];
  const limit = now.getTime() - days * DAY;
  return (sessions || []).filter((s) => s.ts >= limit);
};

// Início da semana (segunda-feira, 00:00 local).
export const weekStart = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

// Volume semanal por grupo muscular: [{weekStart, total, groups:{grupo:volume}}] (últimas `weeks` semanas).
export const weeklyVolumeByMuscle = (checkIns, weeks = 8, now = new Date()) => {
  const current = weekStart(now);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const s = new Date(current);
    s.setDate(s.getDate() - i * 7);
    buckets.push({ weekStart: s.toISOString(), key: s.getTime(), total: 0, groups: {} });
  }
  const index = new Map(buckets.map((b) => [b.key, b]));
  sortedAsc(checkIns).forEach(({ c, d }) => {
    const bucket = index.get(weekStart(d).getTime());
    if (!bucket) return;
    (Array.isArray(c.exercises) ? c.exercises : []).forEach((ex) => {
      const m = sessionMetrics(ex?.sets);
      if (!m) return;
      const g = ex.muscleGroup || 'Outros';
      bucket.groups[g] = round1((bucket.groups[g] || 0) + m.volume);
      bucket.total = round1(bucket.total + m.volume);
    });
  });
  return buckets.map(({ key, ...rest }) => rest);
};

// Frequência e volume por grupo nos últimos `days` dias, ordenado por volume.
export const muscleFrequency = (checkIns, days = 30, now = new Date()) => {
  const limit = now.getTime() - days * DAY;
  const map = {};
  sortedAsc(checkIns).forEach(({ c, d }) => {
    if (d.getTime() < limit || d.getTime() > now.getTime()) return;
    const seen = new Set();
    (Array.isArray(c.exercises) ? c.exercises : []).forEach((ex) => {
      const m = sessionMetrics(ex?.sets);
      if (!m) return;
      const g = ex.muscleGroup || 'Outros';
      map[g] = map[g] || { group: g, sessions: 0, volume: 0 };
      map[g].volume = round1(map[g].volume + m.volume);
      if (!seen.has(g)) {
        seen.add(g);
        map[g].sessions += 1;
      }
    });
  });
  return Object.values(map).sort((a, b) => b.volume - a.volume || a.group.localeCompare(b.group));
};

// Progressão dupla: se todas as séries atingiram o topo da faixa de reps, +2,5% (arredondado a 0,5 kg).
export const suggestNextLoad = (session, { repRange = [8, 12], increment = 0.025 } = {}) => {
  const [low, high] = repRange;
  const sets = session?.sets || [];
  if (!sets.length) return null;
  const weight = Math.max(...sets.map((s) => s.weight));
  if (weight <= 0) return null;
  const working = sets.filter((s) => s.weight === weight);
  const allTop = working.every((s) => s.reps >= high);
  if (allTop) {
    let next = roundToHalf(weight * (1 + increment));
    if (next <= weight) next = weight + 0.5;
    return { weight: next, action: 'aumentar', reason: `Você fez ${high}+ repetições em todas as séries com ${weight} kg. Suba para ${next} kg (+2,5%) e volte para ${low} repetições.` };
  }
  const minReps = Math.min(...working.map((s) => s.reps));
  return { weight, action: 'manter', reason: `Mantenha ${weight} kg e tente chegar a ${high} repetições em todas as séries (hoje a menor foi ${minReps}) antes de subir a carga.` };
};
