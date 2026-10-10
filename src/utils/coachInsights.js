// Métricas puras do treinador: aderência (4 semanas), recordes recentes e fila de ação do dia.
import { toDate, startOfDay, daysSince, DAY_MS } from '../components/coach/helpers';

export const ADHERENCE_DAYS = 28;
export const DEFAULT_WEEKLY_GOAL = 3;

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Grade de 4 semanas x 7 dias (mais antiga primeiro; a última célula é hoje).
export const adherenceGrid = (checkIns = [], now = new Date()) => {
  const today = startOfDay(now);
  const counts = new Map();
  checkIns.forEach((c) => {
    const d = toDate(c.date);
    if (d) counts.set(dayKey(d), (counts.get(dayKey(d)) || 0) + 1);
  });
  const cells = Array.from({ length: ADHERENCE_DAYS }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (ADHERENCE_DAYS - 1 - i));
    return { date, count: counts.get(dayKey(date)) || 0 };
  });
  return Array.from({ length: ADHERENCE_DAYS / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
};

// Aderência 0-100: dias treinados por semana (limitados à meta) sobre a meta total de 4 semanas.
export const adherencePct = (grid, weeklyGoal = DEFAULT_WEEKLY_GOAL) => {
  const goal = Math.min(7, Math.max(1, Number(weeklyGoal) || DEFAULT_WEEKLY_GOAL));
  const done = grid.reduce((acc, week) => acc + Math.min(goal, week.filter((c) => c.count > 0).length), 0);
  return Math.round((done / (goal * grid.length)) * 100);
};

export const groupByUser = (checkIns = []) => {
  const map = {};
  checkIns.forEach((c) => { (map[c.userId] ||= []).push(c); });
  return map;
};

// uid -> { grid, pct, days } para a lista e o detalhe do aluno.
export const adherenceByStudent = (students, checkIns, now = new Date()) => {
  const byUser = groupByUser(checkIns);
  const out = {};
  students.forEach((s) => {
    const grid = adherenceGrid(byUser[s.uid] || [], now);
    out[s.uid] = { grid, pct: adherencePct(grid, s.weeklyGoal), days: grid.flat().filter((c) => c.count > 0).length };
  });
  return out;
};

const maxWeightByExercise = (checkIn) => {
  const out = {};
  (Array.isArray(checkIn.exercises) ? checkIn.exercises : []).forEach((ex) => {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    const w = sets.reduce((m, s) => Math.max(m, Number(s?.weight) || 0), 0);
    if (ex.name && w > 0) out[ex.name] = Math.max(out[ex.name] || 0, w);
  });
  return out;
};

// uid -> recorde de carga mais recente dentro de `withinDays` (só conta se havia marca anterior no histórico carregado).
export const recentRecords = (checkIns = [], now = new Date(), withinDays = 7) => {
  const sorted = [...checkIns].sort((a, b) => (toDate(a.date) || 0) - (toDate(b.date) || 0));
  const best = {}; // `${uid}|${exercicio}` -> maior carga
  const out = {};
  sorted.forEach((c) => {
    const d = toDate(c.date);
    if (!d) return;
    Object.entries(maxWeightByExercise(c)).forEach(([name, w]) => {
      const key = `${c.userId}|${name}`;
      const prev = best[key];
      if (prev !== undefined && w > prev && (now - d) / DAY_MS <= withinDays && (now - d) >= 0) {
        out[c.userId] = { exercise: name, weight: w, previous: prev, date: d };
      }
      if (prev === undefined || w > prev) best[key] = w;
    });
  });
  return out;
};

export const ACTION_PRIORITY = { overdue: 1, inactive: 2, nofile: 3, record: 4 };

// Fila do dia. lastWorkouts: uid -> Date. Itens ordenados por prioridade e depois por urgência.
export const buildActionQueue = ({ students = [], lastWorkouts = {}, checkIns = [], now = new Date(), inactiveDays = 5, newDays = 14 } = {}) => {
  const records = recentRecords(checkIns, now);
  const items = [];
  students.forEach((s) => {
    const uid = s.uid || s.id;
    const last = lastWorkouts[uid] || null;
    const days = last ? daysSince(last, now) : null;
    if (s.paymentStatus === 'overdue') {
      items.push({ id: `overdue-${uid}`, type: 'overdue', student: s, detail: 'Mensalidade atrasada', weight: Number(s.monthlyFee) || 0 });
    }
    if (s.currentTrainingId && (days === null || days >= inactiveDays)) {
      items.push({ id: `inactive-${uid}`, type: 'inactive', student: s, days, weight: days === null ? 999 : days,
        detail: days === null ? 'Ainda não treinou' : `${days} dias sem treinar` });
    }
    if (!s.currentTrainingId) {
      const created = toDate(s.createdAt);
      const isNew = created ? (now - created) / DAY_MS <= newDays : false;
      items.push({ id: `nofile-${uid}`, type: 'nofile', student: s, isNew, weight: isNew ? 1 : 0,
        detail: isNew ? 'Aluno novo sem ficha' : 'Sem ficha atribuída' });
    }
    if (records[uid]) {
      const r = records[uid];
      items.push({ id: `record-${uid}`, type: 'record', student: s, record: r, weight: r.date.getTime(),
        detail: `Recorde em ${r.exercise}: ${r.weight} kg` });
    }
  });
  return items.sort((a, b) => ACTION_PRIORITY[a.type] - ACTION_PRIORITY[b.type] || b.weight - a.weight);
};
