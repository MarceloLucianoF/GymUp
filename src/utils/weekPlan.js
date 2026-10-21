// Semana inteira: divisão por número de dias, dias da semana sugeridos, extras (cardio e alongamento) e o texto que explica a escolha.
// A montagem de cada dia usa o gerador de fichas (biblioteca filtrada pelos equipamentos do aluno; IA com validação e plano local).
export const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const MIN_DAYS = 2;
export const MAX_DAYS = 6;

const WEEKDAYS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
const FULL = 'Full Body (Corpo Todo)';

/** Divisão (foco de cada dia) conforme os dias por semana e a experiência. Iniciante em 3 dias treina corpo todo em dias alternados. */
export function chooseSplit(days, experience = 'iniciante') {
  const n = Math.max(MIN_DAYS, Math.min(MAX_DAYS, Number(days) || 3));
  const level = String(experience || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let foci;
  if (n === 2) foci = [FULL, FULL];
  else if (n === 3) foci = level === 'iniciante' ? [FULL, FULL, FULL] : ['Peito e Tríceps', 'Costas e Bíceps', 'Pernas + Ombros'];
  else if (n === 4) foci = ['Peito e Tríceps', 'Costas e Bíceps', 'Pernas Completo', 'Ombros e ABS'];
  else if (n === 5) foci = ['Peito e Tríceps', 'Costas e Bíceps', 'Pernas Completo', 'Ombros e ABS', 'Posterior e Glúteos'];
  else foci = ['Peito e Tríceps', 'Costas e Bíceps', 'Quadríceps', 'Ombros e ABS', 'Posterior e Glúteos', FULL];
  const seen = {};
  return foci.map((focus, i) => {
    seen[focus] = (seen[focus] || 0) + 1;
    const repeats = foci.filter((f) => f === focus).length;
    const letter = String.fromCharCode(64 + seen[focus]);
    return { focus, weekday: WEEKDAYS[n][i], label: repeats > 1 ? `${focus === FULL ? 'Corpo todo' : focus} ${letter}` : (focus === FULL ? 'Corpo todo' : focus), occurrence: seen[focus] };
  });
}

/** Dias livres (sem treino de musculação) para o cardio e o alongamento extras. */
export function freeWeekdays(split) {
  const used = new Set(split.map((d) => d.weekday));
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => !used.has(d));
}

/** Escolhe um dia livre para o extra, tentando ficar longe dos treinos pesados (meio de dois dias livres primeiro). */
export function pickFreeDay(free, taken = []) {
  const left = free.filter((d) => !taken.includes(d));
  return left.length ? left[Math.floor(left.length / 2)] : null;
}

const total = (plan) => plan.days.filter((d) => d.workout).reduce((n, d) => n + d.workout.exercises.length, 0);

export function planFacts(plan) {
  const trained = plan.days.filter((d) => d.workout && d.kind === 'strength');
  return {
    days: trained.length,
    exercises: total(plan),
    minutesPerDay: plan.durationMinutes,
    goal: plan.goal,
    split: trained.map((d) => `${DAY_LABELS[d.weekday]}: ${d.label}`),
    extras: plan.days.filter((d) => d.workout && d.kind !== 'strength').map((d) => `${DAY_LABELS[d.weekday]}: ${d.label}`),
    own: plan.days.reduce((n, d) => n + (d.workout?.exercises || []).filter((e) => String(e.firestoreId || '').startsWith('mine_')).length, 0)
  };
}

export function localPlanText(plan) {
  const f = planFacts(plan);
  const parts = [`Semana de ${f.days} ${f.days === 1 ? 'treino' : 'treinos'} de cerca de ${f.minutesPerDay} minutos, pensada para ${String(f.goal || 'seu objetivo').toLowerCase()}.`];
  parts.push(`Divisão: ${f.split.join('; ')}.`);
  if (f.extras.length) parts.push(`Extras nos dias livres: ${f.extras.join('; ')}.`);
  if (f.own > 0) parts.push(`Inclui ${f.own} ${f.own === 1 ? 'exercício criado por você' : 'exercícios criados por você'}.`);
  return parts.join(' ');
}

export function planAiMessages(plan) {
  const f = planFacts(plan);
  return [
    { role: 'system', content: 'Você explica, em português do Brasil, em 2 a 3 frases curtas, a lógica de uma semana de treino montada por um aplicativo, falando com o aluno na segunda pessoa. Use SOMENTE os números e nomes do JSON recebido: não calcule, não invente nem converta valores. Sem emojis, sem conselhos médicos e sem parênteses.' },
    { role: 'user', content: JSON.stringify({ dias_de_treino: f.days, minutos_por_treino: f.minutesPerDay, objetivo: f.goal, divisao: f.split, extras: f.extras, exercicios_no_total: f.exercises }) }
  ];
}

const numbersIn = (text) => (String(text || '').match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.'));

/** Texto da IA só vale se todo número dele existir nos fatos da semana. */
export function planTextMatches(text, plan) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 30 || clean.length > 600) return false;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(clean)) return false;
  const allowed = new Set([...numbersIn(localPlanText(plan)), ...numbersIn(planAiMessages(plan)[1].content)]);
  return numbersIn(clean).every((n) => allowed.has(n));
}

export const saveName = (day) => `Semana · ${DAY_SHORT[day.weekday]} · ${day.label}`.slice(0, 80);
export const saveDescription = (day) => `Parte da semana montada pela IA. Sugerido para ${DAY_LABELS[day.weekday].toLowerCase()}${day.weekday < 5 ? '-feira' : ''}.`;
