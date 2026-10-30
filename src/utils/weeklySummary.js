// Resumo semanal: tudo é calculado aqui, de forma determinística, a partir dos treinos CONCLUÍDOS do aluno (check-ins).
// A IA (quando usada) só reescreve estes números em texto; não calcula, não escolhe ficha e não altera dados.
import { dayKey, weekKey } from './consistency';
import { recentRecords } from './records';

const MINUTE = 60;
const toDate = (v) => { const d = v?.toDate ? v.toDate() : new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const fmtInt = (n) => new Intl.NumberFormat('pt-BR').format(Math.round(n));
const fmtDay = (key) => { const [, m, d] = key.split('-'); return `${d}/${m}`; };
export const volumeText = (kg) => (kg >= 1000 ? `${(kg / 1000).toFixed(1).replace('.', ',')} t` : `${fmtInt(kg)} kg`);

const addDays = (date, n) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + n, 12); return d; };
/** Segunda-feira (12:00 local) da semana ISO da data. */
const mondayOf = (date) => { const dow = (date.getDay() + 6) % 7; return addDays(date, -dow); };

/** Treinos concluídos e únicos: sem ID repetido, sem `clientId` repetido (reenvio offline) e sem séries concluídas = 0. */
export function completedWorkouts(history = []) {
  const seen = new Set();
  const out = [];
  for (const h of history) {
    if (!h) continue;
    const date = toDate(h.date);
    if (!date) continue;
    if (h.setsCompleted !== undefined && Number(h.setsCompleted) <= 0) continue;     // treino parcial/sem séries concluídas
    const key = h.clientId || h.id || `${h.trainingId || ''}|${date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...h, _date: date });
  }
  return out;
}

const streakOf = (days, now) => {
  const set = new Set(days);
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!set.has(dayKey(cursor))) cursor = addDays(cursor, -1);          // sem treino hoje, a sequência ainda vale até o fim de hoje
  let n = 0;
  while (set.has(dayKey(cursor))) { n += 1; cursor = addDays(cursor, -1); }
  return n;
};

/**
 * @param {object} p  history, weeklyGoal, now, which: 'current' | 'last'
 * Devolve só números e textos curtos (nada de e-mail, peso ou medidas).
 */
export function buildWeeklySummary({ history = [], weeklyGoal = 4, now = new Date(), which = 'current', tz } = {}) {
  const monday = mondayOf(which === 'last' ? addDays(mondayOf(now), -7) : now);
  const start = dayKey(monday);
  const end = dayKey(addDays(monday, 6));
  const wk = weekKey(monday);
  const prevMonday = addDays(monday, -7);
  const prevWk = weekKey(prevMonday);

  const all = completedWorkouts(history).filter((h) => h._date <= now);
  const inWeek = (key) => all.filter((h) => weekKey(h._date) === key);
  const cur = inWeek(wk);
  const days = [...new Set(cur.map((h) => dayKey(h._date)))].sort();
  const minutes = Math.round(cur.reduce((a, h) => a + (Number(h.duration) || 0), 0) / MINUTE);
  const volume = Math.round(cur.reduce((a, h) => a + (Number(h.totalVolume) || 0), 0));
  const sets = cur.reduce((a, h) => a + (Number(h.setsCompleted) || 0), 0);

  const counts = {};
  cur.forEach((h) => {
    const names = new Set((Array.isArray(h.exercises) ? h.exercises : []).map((e) => e?.name).filter(Boolean));
    names.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
  });
  const topExercises = Object.entries(counts).map(([name, sessions]) => ({ name, sessions }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 3);

  const endOfWeek = new Date(addDays(monday, 6).getFullYear(), addDays(monday, 6).getMonth(), addDays(monday, 6).getDate(), 23, 59, 59);
  const records = recentRecords(all, which === 'last' ? endOfWeek : now, { withinDays: 7, max: 3 })
    .filter((r) => weekKey(r.date) === wk).map((r) => ({ exercise: r.exercise, weight: r.weight, previous: r.previous }));

  const goal = Math.max(0, Number(weeklyGoal) || 0);
  const closed = which === 'last' || dayKey(now) > end;
  // Comparação só entre semanas completas (a semana em andamento não é comparável com uma inteira).
  const prev = inWeek(prevWk);
  const prevVolume = Math.round(prev.reduce((a, h) => a + (Number(h.totalVolume) || 0), 0));
  const comparison = closed && prev.length > 0 && prevVolume > 0
    ? { previousWorkouts: prev.length, previousVolume: prevVolume, volumePct: Math.round(((volume - prevVolume) / prevVolume) * 100) }
    : null;

  const facts = {
    period: which === 'last' ? 'last' : 'current',
    weekKey: wk, start, end, closed,
    tz: tz || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''),
    workouts: cur.length, activeDays: days.length, minutes, volume, sets,
    goal: { weekly: goal, remaining: Math.max(0, goal - cur.length), met: goal > 0 && cur.length >= goal },
    streak: streakOf(all.map((h) => dayKey(h._date)), now),
    records, topExercises, comparison
  };
  facts.texts = { volume: volumeText(volume), range: `${fmtDay(start)} a ${fmtDay(end)}` };
  return facts;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Texto local (sem IA), só com os números de `facts`. */
export function localNarrative(f) {
  const when = f.period === 'last' ? 'na semana passada' : 'nesta semana';
  if (f.workouts === 0) {
    return f.period === 'last'
      ? `Nenhum treino concluído na semana passada (${f.texts.range}).`
      : `Nenhum treino concluído nesta semana ainda. Sua meta é ${plural(f.goal.weekly, 'treino', 'treinos')} por semana: que tal começar hoje?`;
  }
  const parts = [`Você concluiu ${f.workouts}${f.goal.weekly ? ` de ${f.goal.weekly}` : ''} ${f.workouts === 1 && !f.goal.weekly ? 'treino' : 'treinos'} ${when}, em ${plural(f.activeDays, 'dia', 'dias')}, somando ${f.minutes} minutos e ${f.texts.volume}.`];
  if (f.goal.weekly) parts.push(f.goal.met ? 'Meta da semana cumprida.' : `${f.goal.remaining === 1 ? 'Falta' : 'Faltam'} ${plural(f.goal.remaining, 'treino', 'treinos')} para a meta.`);
  if (f.streak > 1) parts.push(`Sequência atual: ${f.streak} dias.`);
  if (f.comparison) parts.push(f.comparison.volumePct === 0 ? 'O volume ficou igual ao da semana anterior.' : `O volume ${f.comparison.volumePct > 0 ? 'subiu' : 'caiu'} ${Math.abs(f.comparison.volumePct)}% em relação à semana anterior.`);
  if (f.records.length) parts.push(`${f.records.length === 1 ? 'Novo recorde' : 'Novos recordes'}: ${f.records.map((r) => `${r.exercise} (${r.weight} kg)`).join(', ')}.`);
  return parts.join(' ');
}

/** Identidade dos números: se não mudou, o texto guardado serve (evita regenerar). */
export function factsHash(f) {
  const core = [f.weekKey, f.closed ? 1 : 0, f.workouts, f.activeDays, f.minutes, f.volume, f.sets, f.goal.weekly, f.goal.met ? 1 : 0, f.streak,
    f.records.map((r) => `${r.exercise}:${r.weight}`).join(','), f.topExercises.map((e) => `${e.name}:${e.sessions}`).join(','), f.comparison ? f.comparison.volumePct : 'x'].join('|');
  let h = 5381;
  for (let i = 0; i < core.length; i += 1) h = ((h << 5) + h + core.charCodeAt(i)) | 0;
  return `v1-${(h >>> 0).toString(36)}`;
}

// ---- IA: o que vai e o que volta ----
/** Mensagens para a IA: só números e nomes de exercício. Nada de nome, e-mail, peso, medidas ou ID. */
export function aiMessages(f) {
  const payload = {
    periodo: f.period === 'last' ? 'semana passada' : 'esta semana (em andamento)',
    intervalo: f.texts.range,
    treinos_concluidos: f.workouts, meta_semanal: f.goal.weekly, faltam_para_meta: f.goal.remaining, meta_cumprida: f.goal.met,
    dias_com_treino: f.activeDays, minutos: f.minutes, volume: f.texts.volume, sequencia_dias: f.streak,
    recordes: f.records.map((r) => `${r.exercise} ${r.weight} kg`),
    exercicios_mais_feitos: f.topExercises.map((e) => `${e.name} (${e.sessions} treino${e.sessions === 1 ? '' : 's'})`),
    variacao_volume_vs_semana_anterior_pct: f.comparison ? f.comparison.volumePct : null
  };
  return [
    { role: 'system', content: 'Você escreve o resumo semanal de treino de um aplicativo, em português do Brasil, em 2 a 3 frases curtas e amigáveis. Use SOMENTE os números e nomes do JSON recebido: não calcule, não arredonde, não invente nem converta valores. Sem emojis, sem conselhos médicos, sem cobrança ou culpa.' },
    { role: 'user', content: JSON.stringify(payload) }
  ];
}

const numbersIn = (text) => (String(text || '').match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.'));

/** A resposta da IA só vale se todo número dela existe nos fatos (ou no texto local, que usa os mesmos fatos). */
export function narrativeMatchesFacts(text, f) {
  const clean = String(text || '').trim();
  if (clean.length < 20 || clean.length > 700) return false;
  const allowed = new Set([...numbersIn(localNarrative(f)), ...numbersIn(aiMessages(f)[1].content), ...numbersIn(f.texts.range)]);
  return numbersIn(clean).every((n) => allowed.has(n));
}
