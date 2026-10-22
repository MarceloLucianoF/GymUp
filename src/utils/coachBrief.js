// "Resumo do aluno" para o treinador: fatos das últimas 4 semanas calculados aqui (frequência, aderência, cargas que subiram,
// exercícios estagnados, esforço alto) e um texto local. A IA só reescreve o texto, e a resposta só vale com os mesmos números.
import { adherenceGrid, adherencePct, DEFAULT_WEEKLY_GOAL } from './coachInsights';

const DAY = 24 * 3600 * 1000;
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const kg = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const dateOf = (c) => { const t = new Date(c?.date || c?.createdAt).getTime(); return Number.isFinite(t) ? t : null; };

/** Melhor série de trabalho de um exercício num treino: maior carga e, nela, mais repetições; mais o RPE médio. */
function bestSet(ex) {
  const sets = (ex?.sets || []).filter((s) => s && s.completed !== false && s.type !== 'warmup' && s.type !== 'drop');
  if (!sets.length) return null;
  const top = Math.max(...sets.map((s) => num(s.weight)));
  const reps = Math.max(...sets.filter((s) => num(s.weight) === top).map((s) => num(s.reps)));
  const rpes = sets.map((s) => num(s.rpe)).filter((r) => r > 0);
  return { load: top, reps, rpe: rpes.length === sets.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null };
}

/**
 * @param checkIns do aluno (qualquer ordem); @param weeklyGoal meta semanal; @param now
 * Devolve fatos com números já arredondados (os mesmos que o texto e a IA podem usar).
 */
export function buildCoachFacts({ checkIns = [], weeklyGoal = DEFAULT_WEEKLY_GOAL, now = Date.now() }) {
  const goal = Math.min(7, Math.max(1, Number(weeklyGoal) || DEFAULT_WEEKLY_GOAL));
  const rows = checkIns.map((c) => ({ c, t: dateOf(c) })).filter((r) => r.t !== null && r.t <= now).sort((a, b) => a.t - b.t);
  const recent = rows.filter((r) => now - r.t <= 28 * DAY);
  const last = rows[rows.length - 1];
  const daysSinceLast = last ? Math.floor((now - last.t) / DAY) : null;
  const adherence = adherencePct(adherenceGrid(rows.map((r) => r.c), new Date(now)), goal);

  // Por exercício, nas 4 semanas: primeira e última melhor série, quantas vezes apareceu e o RPE da última vez.
  const byEx = new Map();
  recent.forEach(({ c }) => (c.exercises || []).forEach((ex) => {
    const b = bestSet(ex);
    if (!ex?.name || !b || b.load <= 0) return;
    const cur = byEx.get(ex.name) || { name: ex.name, first: b, last: b, sessions: 0 };
    cur.last = b; cur.sessions += 1;
    byEx.set(ex.name, cur);
  }));
  const list = [...byEx.values()];
  const progressing = list.filter((e) => e.last.load > e.first.load)
    .map((e) => ({ name: e.name, from: kg(e.first.load), to: kg(e.last.load) }))
    .sort((a, b) => num(b.to) - num(b.from) - (num(a.to) - num(a.from))).slice(0, 3);
  const stalled = list.filter((e) => e.sessions >= 3 && e.last.load <= e.first.load && e.last.reps <= e.first.reps)
    .map((e) => ({ name: e.name, load: kg(e.last.load), sessions: e.sessions })).slice(0, 3);
  const hardEffort = list.filter((e) => e.last.rpe !== null && e.last.rpe >= 9).map((e) => e.name).slice(0, 3);

  return { workouts28: recent.length, goal, adherence, daysSinceLast, progressing, stalled, hardEffort, hasHistory: rows.length > 0 };
}

/** Texto local, na terceira pessoa, para o treinador. */
export function coachBriefText(f, name = 'O aluno') {
  if (!f.hasHistory) return `${name} ainda não registrou treinos no app.`;
  const parts = [`${name} fez ${plural(f.workouts28, 'treino', 'treinos')} nas últimas 4 semanas, com ${f.adherence}% de aderência à meta de ${f.goal} por semana.`];
  if (f.daysSinceLast >= 7) parts.push(`Está há ${f.daysSinceLast} dias sem treinar: vale mandar uma mensagem.`);
  if (f.progressing.length) parts.push(`Subiu carga em ${f.progressing.map((p) => `${p.name} (${p.from} para ${p.to} kg)`).join(', ')}.`);
  if (f.stalled.length) parts.push(`Parado em ${f.stalled.map((s) => `${s.name} (${s.load} kg em ${s.sessions} treinos)`).join(', ')}: considere ajustar a faixa de repetições, o descanso ou trocar a variação.`);
  if (f.hardEffort.length) parts.push(`Esforço muito alto (RPE 9 ou mais) em ${f.hardEffort.join(', ')}: confira técnica e recuperação.`);
  return parts.join(' ');
}

/** Mensagens para a IA: só números e nomes de exercício (sem peso corporal, medidas ou dados de saúde). */
export function coachBriefAiMessages(f, name = 'O aluno') {
  const payload = {
    aluno: name, treinos_4_semanas: f.workouts28, aderencia_pct: f.adherence, meta_semanal: f.goal, dias_sem_treinar: f.daysSinceLast,
    subiu_carga: f.progressing.map((p) => `${p.name}: ${p.from} kg para ${p.to} kg`),
    estagnado: f.stalled.map((s) => `${s.name}: ${s.load} kg em ${s.sessions} treinos`),
    esforco_alto: f.hardEffort
  };
  return [
    { role: 'system', content: 'Você ajuda um personal trainer a acompanhar um aluno. Escreva em português do Brasil, em 3 a 5 frases curtas, na terceira pessoa, um resumo objetivo das últimas 4 semanas e no máximo duas sugestões práticas de ajuste no treino. Use SOMENTE os números e nomes do JSON: não calcule, não arredonde, não invente nem converta valores. Sem diagnóstico, sem conselho médico, sem emojis, sem julgamento sobre o aluno.' },
    { role: 'user', content: JSON.stringify(payload) }
  ];
}

const numbersIn = (text) => (String(text || '').match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.'));

/** A resposta da IA só vale se cada número dela estiver nos fatos. */
export function coachBriefMatches(text, f, name) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 30 || clean.length > 900) return false;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(clean)) return false;
  const allowed = new Set([...numbersIn(coachBriefText(f, name)), ...numbersIn(coachBriefAiMessages(f, name)[1].content), '4']);
  return numbersIn(clean).every((n) => allowed.has(n));
}
