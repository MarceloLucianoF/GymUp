// Consistência semanal (treinos, dias ativos, sequência) derivada de datas de check-in. Só datas: nenhum dado de saúde.
const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Semana ISO (segunda a domingo) no fuso do aparelho, no formato AAAA-Wss (ordenável como texto).
export const weekKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
};

const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12));
};

/** Contadores novos depois de um check-in (criação). `prev` pode ser nulo ou de antes dos campos semanais. */
export function afterCheckIn(prev, date) {
  const day = dayKey(date);
  const wk = weekKey(date);
  const old = prev || {};
  const out = {};

  if (!wk || !day) return out;
  if (!old.weekKey || wk > old.weekKey) { out.weekKey = wk; out.weekCount = 1; out.weekDays = [day]; }
  else if (wk === old.weekKey) {
    out.weekKey = wk;
    out.weekCount = (Number(old.weekCount) || 0) + 1;
    out.weekDays = [...new Set([...(old.weekDays || []), day])].slice(-7);
  } else { // check-in de semana anterior (sincronização atrasada): a semana atual não muda
    out.weekKey = old.weekKey; out.weekCount = Number(old.weekCount) || 0; out.weekDays = old.weekDays || [];
  }

  const last = old.lastActiveDay || '';
  if (!last) { out.streak = 1; out.lastActiveDay = day; }
  else if (day === last || day < last) { out.streak = Number(old.streak) || 1; out.lastActiveDay = last; }
  else if (day === addDays(last, 1)) { out.streak = (Number(old.streak) || 0) + 1; out.lastActiveDay = day; }
  else { out.streak = 1; out.lastActiveDay = day; }
  return out;
}

/** Ajuste ao apagar um check-in: baixa a semana corrente se o treino apagado era dela. */
export function afterRemoval(prev, date) {
  const old = prev || {};
  const weekCount = old.weekKey && weekKey(date) === old.weekKey ? Math.max(0, (Number(old.weekCount) || 0) - 1) : Number(old.weekCount) || 0;
  return { weekKey: old.weekKey || '', weekCount, weekDays: old.weekDays || [], streak: Number(old.streak) || 0, lastActiveDay: old.lastActiveDay || '' };
}

/** Números exibidos no ranking, para a semana de `now`. Dados de outra semana contam zero. */
export function consistency(stats, now = new Date()) {
  const s = stats || {};
  const current = s.weekKey === weekKey(now);
  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  const alive = s.lastActiveDay && (s.lastActiveDay === today || s.lastActiveDay === yesterday);
  return {
    workouts: current ? Number(s.weekCount) || 0 : 0,
    activeDays: current ? (s.weekDays || []).length : 0,
    streak: alive ? Number(s.streak) || 0 : 0
  };
}

/** Ordena: treinos, depois dias ativos, depois sequência, depois nome. */
export function rankRows(rows) {
  const sorted = [...rows].sort((a, b) => b.workouts - a.workouts || b.activeDays - a.activeDays || b.streak - a.streak || String(a.name).localeCompare(String(b.name), 'pt-BR'));
  const same = (a, b) => a.workouts === b.workouts && a.activeDays === b.activeDays && a.streak === b.streak;
  const out = [];
  sorted.forEach((row, index) => out.push({ ...row, position: index > 0 && same(sorted[index - 1], row) ? out[index - 1].position : index + 1 }));
  return out;
}
