// Helpers puros das telas do treinador (datas, moeda, status de aluno).
export const DAY_MS = 24 * 60 * 60 * 1000;
export const RISK_DAYS = 7;

export const toDate = (value) => {
  if (!value) return null;
  const date = value?.seconds ? new Date(value.seconds * 1000) : (value instanceof Date ? value : new Date(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const startOfDay = (value = new Date()) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

export const brl = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value) || 0);

// Tempo relativo em pt-BR ("há 5 min", "ontem", "há 3 dias").
export const timeAgo = (value, now = new Date()) => {
  const date = toDate(value);
  if (!date) return '-';
  const diff = Math.max(0, now - date);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export const daysSince = (value, now = new Date()) => {
  const date = toDate(value);
  return date ? Math.floor((now - date) / DAY_MS) : null;
};

// 'active' treinou nos últimos 7 dias; 'risk' parou; 'new' nunca treinou.
export const studentStatus = (lastWorkout, now = new Date()) => {
  const days = daysSince(lastWorkout, now);
  if (days === null) return 'new';
  return days >= RISK_DAYS ? 'risk' : 'active';
};

export const STATUS_META = {
  active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  risk: { label: 'Em risco', cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  new: { label: 'Sem treino', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' }
};

export const chatState = (student) => ({
  targetUser: { uid: student.uid || student.id, displayName: student.displayName || 'Aluno', photoURL: student.photoURL }
});

export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const monthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

// Treinos de um check-in contam 1; frequência por dia nos últimos `days` dias (mais antigo primeiro).
export const countByDay = (checkIns, days = 7, now = new Date()) => {
  const today = startOfDay(now);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - (days - 1 - i) * DAY_MS);
    return { date: d, label: WEEKDAYS_SHORT[d.getDay()], value: 0 };
  });
  checkIns.forEach((c) => {
    const d = toDate(c.date);
    if (!d) return;
    const idx = Math.floor((startOfDay(d) - today) / DAY_MS) + days - 1;
    if (idx >= 0 && idx < days) buckets[idx].value += 1;
  });
  return buckets;
};

// Volume estimado de uma ficha (séries x reps, sem carga). Aceita "3", "10", "8-12".
export const parseReps = (reps) => {
  const nums = String(reps ?? '').match(/\d+/g);
  if (!nums) return 0;
  return nums.reduce((a, n) => a + Number(n), 0) / nums.length;
};
export const estimateWorkout = (exercises = []) => {
  let sets = 0;
  let reps = 0;
  let restSeconds = 0;
  exercises.forEach((ex) => {
    const s = Array.isArray(ex.sets) ? ex.sets.length : (Number(ex.sets) || 0);
    const r = Array.isArray(ex.sets) ? parseReps(ex.sets[0]?.reps) : parseReps(ex.reps);
    sets += s;
    reps += s * r;
    restSeconds += s * (Number(ex.rest) || 60);
  });
  // ~40s de execução por série + descanso
  const minutes = Math.round((sets * 40 + restSeconds) / 60);
  return { sets, reps: Math.round(reps), minutes };
};
