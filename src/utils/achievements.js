// Conquistas e nível do aluno, calculados na exibição a partir dos check-ins (sem servidor, nada gravado).
// Anti-abuso: no máximo 1 treino por dia; treino com menos de 10 min, menos de 3 séries de trabalho
// ou registrado mais de 24 h depois da data não conta. Pontos gravados ficam para o Worker, depois.
import { dayKey } from './consistency';
import { countsAsWork } from './setTypes';

export const MIN_DURATION_SEC = 600;
export const MIN_WORK_SETS = 3;
const MAX_BACKDATE_MS = 24 * 3600 * 1000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const LEVELS = [
  { name: 'Iniciante', min: 0 },
  { name: 'Regular', min: 10 },
  { name: 'Dedicado', min: 50 },
  { name: 'Atleta', min: 100 },
];

const toDate = (v) => {
  if (!v) return null;
  const d = v?.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Séries de trabalho concluídas (aquecimento não conta). Usa `setsCompleted` do check-in quando existe. */
export function workSetsOf(checkIn) {
  if (typeof checkIn?.setsCompleted === 'number' && Number.isFinite(checkIn.setsCompleted)) return checkIn.setsCompleted;
  return (Array.isArray(checkIn?.exercises) ? checkIn.exercises : []).reduce((acc, ex) => acc + (Array.isArray(ex?.sets) ? ex.sets : [])
    .filter((s) => s && s.completed !== false && countsAsWork(s.type)).length, 0);
}

/** O treino vale para conquistas e nível? Duração ausente (check-ins antigos) não reprova; as séries ainda são exigidas. */
export function isCountable(checkIn) {
  const date = toDate(checkIn?.date);
  if (!date) return false;
  const duration = Number(checkIn?.duration);
  if (checkIn?.duration != null && Number.isFinite(duration) && duration < MIN_DURATION_SEC) return false;
  if (workSetsOf(checkIn) < MIN_WORK_SETS) return false;
  const created = toDate(checkIn?.createdAt);
  if (created && created - date > MAX_BACKDATE_MS) return false;
  return true;
}

/** Treinos que contam, do mais antigo ao mais recente, no máximo 1 por dia (o primeiro do dia). */
export function countableWorkouts(history = []) {
  const seen = new Set();
  return (history || [])
    .filter(isCountable)
    .map((c) => ({ c, d: toDate(c.date) }))
    .sort((a, b) => a.d - b.d)
    .filter(({ d }) => { const k = dayKey(d); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Nível pelo número de treinos válidos e o quanto falta para o próximo (barra em %). */
export function levelOf(count = 0) {
  const n = Math.max(0, Number(count) || 0);
  let i = 0;
  LEVELS.forEach((l, idx) => { if (n >= l.min) i = idx; });
  const current = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const progress = next ? Math.min(100, Math.max(0, ((n - current.min) / (next.min - current.min)) * 100)) : 100;
  return { name: current.name, count: n, min: current.min, next: next ? next.name : null, nextAt: next ? next.min : null, remaining: next ? next.min - n : 0, progress };
}

// Segunda-feira da semana (meio-dia local) como índice de semana, para achar semanas seguidas.
const weekIndex = (d) => {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7), 12);
  return Math.round(monday.getTime() / WEEK_MS);
};
const dayIndex = (d) => Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() / DAY_MS);

const maxByExercise = (checkIn) => {
  const out = {};
  (Array.isArray(checkIn?.exercises) ? checkIn.exercises : []).forEach((ex) => {
    const w = (Array.isArray(ex?.sets) ? ex.sets : []).reduce((m, s) => (s?.completed === false || !countsAsWork(s?.type) ? m : Math.max(m, Number(s?.weight) || 0)), 0);
    if (ex?.name && w > 0) out[ex.name] = Math.max(out[ex.name] || 0, w);
  });
  return out;
};

/** Maior sequência de itens consecutivos (índices inteiros ordenados) e quando ela chegou a `target`. */
function runInfo(indices, target) {
  let best = 0; let run = 0; let reachedAt = -1;
  indices.forEach((v, i) => {
    run = i > 0 && v === indices[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
    if (reachedAt < 0 && run >= target) reachedAt = i;
  });
  return { best, reachedAt };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Conquistas fixas: [{ id, label, how, unlocked, date, missing, current, target }] e o nível.
 * `how` diz como se ganha; `missing` diz o que falta (só nas bloqueadas); `date` = quando foi obtida.
 */
export function computeAchievements(history = [], { weeklyGoal = 4 } = {}) {
  const list = countableWorkouts(history);
  const count = list.length;
  const goal = Math.max(1, Math.min(7, Number(weeklyGoal) || 4));
  const out = [];
  const add = (a) => out.push({ ...a, unlocked: !!a.date, missing: a.date ? '' : a.missing });

  add({ id: 'first', label: 'Primeiro treino', how: 'Concluiu o primeiro treino.', date: list[0]?.d || null, current: Math.min(count, 1), target: 1, missing: 'Conclua um treino (10 min e 3 séries ou mais).' });
  [10, 50, 100].forEach((n) => add({
    id: `t${n}`, label: `${n} treinos`, how: `Concluiu ${n} treinos.`, date: list[n - 1]?.d || null,
    current: Math.min(count, n), target: n, missing: `${n - count === 1 ? 'Falta' : 'Faltam'} ${plural(n - count, 'treino', 'treinos')}.`,
  }));

  // 4 semanas seguidas batendo a meta semanal (contando só os treinos válidos).
  const perWeek = new Map();
  list.forEach(({ d }) => {
    const w = weekIndex(d);
    const entry = perWeek.get(w) || { n: 0, hitAt: null };
    entry.n += 1;
    if (entry.n === goal) entry.hitAt = d;
    perWeek.set(w, entry);
  });
  const hitWeeks = [...perWeek.entries()].filter(([, e]) => e.hitAt).sort((a, b) => a[0] - b[0]);
  const weeks = runInfo(hitWeeks.map(([w]) => w), 4);
  add({
    id: 'weeks4', label: '4 semanas na meta', how: `Bateu a meta de ${plural(goal, 'treino', 'treinos')} por semana em 4 semanas seguidas.`,
    date: weeks.reachedAt >= 0 ? hitWeeks[weeks.reachedAt][1].hitAt : null, current: Math.min(weeks.best, 4), target: 4,
    missing: `Bata a meta semanal (${plural(goal, 'treino', 'treinos')}) em 4 semanas seguidas. Melhor sequência: ${weeks.best} de 4.`,
  });

  // Primeiro recorde de carga: maior carga de um exercício passando a melhor marca anterior.
  const best = {};
  let prDate = null;
  list.forEach(({ c, d }) => {
    Object.entries(maxByExercise(c)).forEach(([name, w]) => {
      if (!prDate && best[name] !== undefined && w > best[name]) prDate = d;
      if (best[name] === undefined || w > best[name]) best[name] = w;
    });
  });
  add({ id: 'pr1', label: 'Primeiro recorde', how: 'Superou a sua maior carga em um exercício.', date: prDate, current: prDate ? 1 : 0, target: 1, missing: 'Supere a maior carga que você já levantou em um exercício.' });

  // 7 dias seguidos treinando.
  const days = list.map(({ d }) => dayIndex(d));
  const streak = runInfo(days, 7);
  add({
    id: 'streak7', label: '7 dias seguidos', how: 'Treinou 7 dias seguidos.', date: streak.reachedAt >= 0 ? list[streak.reachedAt].d : null,
    current: Math.min(streak.best, 7), target: 7, missing: `Treine 7 dias seguidos. Melhor sequência: ${plural(streak.best, 'dia', 'dias')}.`,
  });

  return { count, level: levelOf(count), achievements: out };
}
