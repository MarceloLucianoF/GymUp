// Resumo pós-treino. Os números vêm do que o aluno registrou (determinísticos); o texto pode ser reescrito pela IA, mas só vale se
// todo número dele existir nos fatos. Sem IA ou sem rede, o texto local diz o mesmo. Nada daqui altera treino, metas ou permissões.
import { sessionMetrics, toDate } from './analytics';
import { suggestNext, fmtKg } from './progression';
import { isSetType } from './setTypes';

const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const pluralize = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const kgText = (n) => fmtKg(Math.round(n * 10) / 10);

const plannedWorkSets = (training) => (training?.exercises || []).reduce((acc, ex) => {
  const total = parseInt(ex.sets, 10) || 0;
  const warm = Array.isArray(ex.setTypes) ? ex.setTypes.filter((t) => t === 'warmup').length : 0;
  return acc + Math.max(0, total - warm);
}, 0);

const lastWith = (history, exName) => (history || []).find((d) => Array.isArray(d?.exercises) && d.exercises.some((e) => e?.name === exName && Array.isArray(e.sets) && e.sets.length));
const sameWorkout = (training) => (d) => (training?.id && d.trainingId === training.id) || (training?.name && d.trainingName === training.name);

// Segunda-feira 00:00 local da semana de `now`
const weekStart = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };

/** Fatos do treino concluído. `history`: check-ins ANTERIORES (mais novo primeiro). */
export function buildSessionFacts({ training, executedExercises = [], totalVolume = 0, setsCompleted = 0, duration = 0, history = [], newPRs = [], weeklyGoal = null, now = Date.now() }) {
  const prevSame = (history || []).find(sameWorkout(training));
  const prevVolume = prevSame ? num(prevSame.totalVolume) : 0;
  const volumePct = prevVolume > 0 ? Math.round(((totalVolume - prevVolume) / prevVolume) * 100) : null;

  const counts = { warmup: 0, drop: 0, failure: 0, cluster: 0 };
  executedExercises.forEach((e) => e.sets.forEach((s) => { if (isSetType(s.type) && s.type !== 'normal') counts[s.type] += 1; }));

  const exercises = executedExercises.map((e) => {
    const cur = sessionMetrics(e.sets);
    const prevDoc = lastWith(history, e.name);
    const prev = prevDoc ? sessionMetrics(prevDoc.exercises.find((x) => x.name === e.name).sets) : null;
    let trend = 'new';
    let delta = null;
    if (cur && prev) {
      if (cur.maxWeight > prev.maxWeight) { trend = 'load'; delta = Math.round((cur.maxWeight - prev.maxWeight) * 100) / 100; }
      else if (cur.maxWeight === prev.maxWeight && cur.bestSet && prev.bestSet && cur.bestSet.reps > prev.bestSet.reps) { trend = 'reps'; delta = cur.bestSet.reps - prev.bestSet.reps; }
      else if (prev.e1rm > 0 && cur.e1rm < prev.e1rm * 0.95) trend = 'down';
      else trend = 'same';
    }
    return { name: e.name, top: cur?.bestSet ? { weight: cur.bestSet.weight, reps: cur.bestSet.reps } : null, workSets: cur ? cur.sets.length : 0, trend, delta };
  }).filter((e) => e.workSets > 0 || e.top);

  const planned = plannedWorkSets(training);
  const adherencePct = planned > 0 ? Math.min(100, Math.round((setsCompleted / planned) * 100)) : null;
  const doneNames = new Set(executedExercises.map((e) => e.name));
  const skipped = (training?.exercises || []).map((e) => e.name).filter((n) => n && !doneNames.has(n));

  const highlights = [
    ...newPRs.map((n) => ({ kind: 'record', name: n })),
    ...exercises.filter((e) => e.trend === 'load' && !newPRs.includes(e.name)).map((e) => ({ kind: 'load', name: e.name, delta: e.delta })),
    ...exercises.filter((e) => e.trend === 'reps').map((e) => ({ kind: 'reps', name: e.name, delta: e.delta }))
  ].slice(0, 3);
  const attention = [
    ...exercises.filter((e) => e.trend === 'down').slice(0, 2).map((e) => ({ kind: 'down', name: e.name })),
    ...(skipped.length ? [{ kind: 'skipped', names: skipped.slice(0, 3), count: skipped.length }] : [])
  ];

  // Para o próximo treino: a sugestão de carga calculada como se esta sessão já estivesse no histórico
  const synthetic = { date: new Date(now).toISOString(), exercises: executedExercises };
  const next = [];
  for (const planEx of training?.exercises || []) {
    if (next.length >= 3) break;
    if (!doneNames.has(planEx.name) || ['cardio', 'timed'].includes(planEx.kind)) continue;
    const s = suggestNext({ historyDocs: [synthetic, ...(history || [])], exName: planEx.name, reps: planEx.reps, exercise: planEx });
    if (s && s.load > 0 && (s.kind === 'increase' || s.kind === 'reps')) next.push({ name: planEx.name, kind: s.kind, load: s.load, reps: s.reps });
  }

  const start = weekStart(now).getTime();
  const weekWorkouts = 1 + (history || []).filter((d) => { const t = toDate(d?.date); return t && t.getTime() >= start; }).length;

  return {
    minutes: Math.max(1, Math.round((duration || 0) / 60)),
    volume: Math.round(totalVolume),
    workSets: setsCompleted,
    plannedSets: planned,
    adherencePct,
    volumePct,
    daysSinceSame: prevSame && toDate(prevSame.date) ? Math.max(0, Math.round((now - toDate(prevSame.date).getTime()) / 86400000)) : null,
    counts,
    exercises,
    records: newPRs,
    highlights,
    attention,
    next,
    week: { done: weekWorkouts, goal: weeklyGoal && weeklyGoal > 0 ? weeklyGoal : null }
  };
}

const highlightText = (h) => (h.kind === 'record' ? `novo recorde em ${h.name}` : h.kind === 'load' ? `mais carga em ${h.name} (+${kgText(h.delta)} kg)` : `mais repetições em ${h.name} (+${h.delta})`);

/** Texto local: 2 a 4 frases com os mesmos números do painel. */
export function localSummaryText(f) {
  const parts = [];
  let first = `Treino concluído em ${f.minutes} min, com ${pluralize(f.workSets, 'série de trabalho', 'séries de trabalho')} e ${f.volume} kg de volume`;
  if (f.volumePct !== null && f.volumePct !== 0) first += `, ${Math.abs(f.volumePct)}% ${f.volumePct > 0 ? 'a mais' : 'a menos'} que da última vez`;
  parts.push(`${first}.`);
  if (f.highlights.length) parts.push(`Destaques: ${f.highlights.map(highlightText).join('; ')}.`);
  const down = f.attention.find((a) => a.kind === 'down');
  const skipped = f.attention.find((a) => a.kind === 'skipped');
  if (down) parts.push(`Atenção: ${down.name} rendeu menos que da última vez; confira o descanso e a carga.`);
  if (skipped) parts.push(`Ficaram de fora: ${skipped.names.join(', ')}${skipped.count > skipped.names.length ? ' e mais' : ''}.`);
  if (f.next.length) parts.push(`No próximo treino: ${f.next.map((n) => `${n.name} com ${kgText(n.load)} kg por ${n.reps}`).join('; ')}.`);
  if (f.week.goal) parts.push(f.week.done >= f.week.goal ? `Meta da semana cumprida: ${f.week.done} de ${f.week.goal} ${f.week.goal === 1 ? 'treino' : 'treinos'}.` : `Esta semana: ${f.week.done} de ${f.week.goal} ${f.week.goal === 1 ? 'treino' : 'treinos'}.`);
  return parts.join(' ');
}

/** Mensagens para a IA: só números e nomes de exercício. */
export function summaryAiMessages(f) {
  const payload = {
    minutos: f.minutes, volume_kg: f.volume, series_de_trabalho: f.workSets, variacao_volume_pct: f.volumePct,
    recordes: f.records, destaques: f.highlights.map(highlightText),
    atencao: f.attention.map((a) => (a.kind === 'down' ? `${a.name} rendeu menos que da última vez` : `não feitos: ${a.names.join(', ')}`)),
    proximo_treino: f.next.map((n) => `${n.name}: ${kgText(n.load)} kg por ${n.reps} repetições`),
    semana: f.week.goal ? `${f.week.done} de ${f.week.goal} ${f.week.goal === 1 ? 'treino' : 'treinos'}` : pluralize(f.week.done, 'treino feito', 'treinos feitos')
  };
  return [
    { role: 'system', content: 'Você escreve o resumo de um treino que acabou de terminar, para um aplicativo, em português do Brasil, em 2 a 4 frases curtas, falando com o aluno na segunda pessoa ("você"), no tom de um treinador atento e animado. Não repita a mesma informação. Use SOMENTE os números e nomes do JSON recebido: não calcule, não arredonde, não invente nem converta valores. Escreva frases naturais, sem copiar os nomes dos campos nem usar parênteses. Sem emojis, sem conselhos médicos, sem cobrança ou culpa.' },
    { role: 'user', content: JSON.stringify(payload) }
  ];
}

const numbersIn = (text) => (String(text || '').match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.'));

/** A resposta da IA só vale se todo número dela existir nos fatos (ou no texto local, que usa os mesmos fatos). */
export function summaryMatchesFacts(text, f) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 20 || clean.length > 700) return false;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(clean)) return false;   // sem emoji
  const allowed = new Set([...numbersIn(localSummaryText(f)), ...numbersIn(summaryAiMessages(f)[1].content)]);
  return numbersIn(clean).every((n) => allowed.has(n));
}

export const TREND_LABEL = { load: 'Mais carga', reps: 'Mais repetições', same: 'Igual', down: 'Abaixo', new: 'Novo' };
