import { buildSessionFacts, localSummaryText, summaryAiMessages, summaryMatchesFacts } from './sessionSummary';

const S = (weight, reps, extra = {}) => ({ weight, reps, completed: true, ...extra });
const NOW = new Date('2026-10-21T15:00:00-03:00').getTime();   // quarta-feira
const training = { id: 't1', name: 'Superiores A', exercises: [
  { name: 'Supino Reto Máquina', sets: '4', reps: '8-12', setTypes: ['warmup', 'normal', 'normal', 'normal'] },
  { name: 'Remada Máquina (Sentado)', sets: '3', reps: '8-12' },
  { name: 'Rosca Direta com Halteres', sets: '3', reps: '8-12', equipment: 'halter' },
  { name: 'Abdominal no Solo (Crunch)', sets: '3', reps: '15' }
] };
const history = [
  { date: '2026-10-19T10:00:00.000Z', trainingId: 't1', trainingName: 'Superiores A', totalVolume: 3000, exercises: [
    { name: 'Supino Reto Máquina', sets: [S(50, 12), S(50, 12), S(50, 12)] },
    { name: 'Remada Máquina (Sentado)', sets: [S(40, 10), S(40, 10), S(40, 10)] },
    { name: 'Rosca Direta com Halteres', sets: [S(12, 10), S(12, 10), S(12, 9)] }
  ] },
  { date: '2026-10-14T10:00:00.000Z', trainingId: 't1', trainingName: 'Superiores A', totalVolume: 2500, exercises: [] }
];
const executed = [
  { name: 'Supino Reto Máquina', sets: [S(20, 12, { type: 'warmup' }), S(55, 10), S(55, 10), S(55, 9)] },
  { name: 'Remada Máquina (Sentado)', sets: [S(40, 11), S(40, 11), S(40, 11)] },
  { name: 'Rosca Direta com Halteres', sets: [S(10, 8), S(10, 8), S(10, 8)] }
];
const facts = (over = {}) => buildSessionFacts({ training, executedExercises: executed, totalVolume: 3300, setsCompleted: 9, duration: 3000, history, newPRs: ['Supino Reto Máquina'], weeklyGoal: 4, now: NOW, ...over });

test('números do treino: tempo, volume, variação contra a última vez do mesmo treino, séries e aderência', () => {
  const f = facts();
  expect(f.minutes).toBe(50);
  expect(f.volume).toBe(3300);
  expect(f.volumePct).toBe(10);                // 3300 contra 3000
  expect(f.workSets).toBe(9);
  expect(f.plannedSets).toBe(12);              // 3 + 3 + 3 + 3 (o aquecimento planejado não conta)
  expect(f.adherencePct).toBe(75);
  expect(f.counts).toEqual({ warmup: 1, drop: 0, failure: 0, cluster: 0 });
  expect(f.daysSinceSame).toBe(2);
});

test('tendência por exercício: carga, repetições, igual, abaixo e novo', () => {
  const f = facts();
  const t = Object.fromEntries(f.exercises.map((e) => [e.name, e]));
  expect(t['Supino Reto Máquina']).toMatchObject({ trend: 'load', delta: 5, top: { weight: 55, reps: 10 } });   // o aquecimento de 20 kg não conta
  expect(t['Remada Máquina (Sentado)']).toMatchObject({ trend: 'reps', delta: 1 });
  expect(t['Rosca Direta com Halteres']).toMatchObject({ trend: 'down' });                                       // 10 kg x 8 contra 12 kg x 10
  const novo = buildSessionFacts({ training, executedExercises: [{ name: 'Exercício Novo', sets: [S(10, 10)] }], totalVolume: 100, setsCompleted: 1, duration: 600, history, now: NOW });
  expect(novo.exercises[0].trend).toBe('new');
});

test('destaques, atenção e itens não feitos', () => {
  const f = facts();
  expect(f.highlights.map((h) => h.kind)).toEqual(['record', 'reps']);
  expect(f.attention).toEqual([{ kind: 'down', name: 'Rosca Direta com Halteres' }, { kind: 'skipped', names: ['Abdominal no Solo (Crunch)'], count: 1 }]);
});

test('para o próximo treino: sugestão calculada como se esta sessão já estivesse no histórico', () => {
  const f = facts({ executedExercises: [{ name: 'Supino Reto Máquina', sets: [S(60, 12), S(60, 12), S(60, 12)] }], newPRs: [] });
  expect(f.next).toEqual([{ name: 'Supino Reto Máquina', kind: 'increase', load: 62.5, reps: 8 }]);
});

test('semana: conta este treino e os da semana no histórico (segunda a domingo)', () => {
  const f = facts();
  expect(f.week).toEqual({ done: 2, goal: 4 });   // hoje + o de 19/10 (segunda)
  expect(facts({ weeklyGoal: null }).week.goal).toBeNull();
});

test('texto local traz os mesmos números e sem treino anterior não fala de variação', () => {
  const t = localSummaryText(facts());
  expect(t).toMatch(/Treino concluído em 50 min, com 9 séries de trabalho e 3300 kg de volume, 10% a mais que da última vez\./);
  expect(t).toMatch(/novo recorde em Supino Reto Máquina/);
  expect(t).toMatch(/Esta semana: 2 de 4 treinos\./);
  const first = localSummaryText(buildSessionFacts({ training, executedExercises: executed, totalVolume: 3300, setsCompleted: 9, duration: 3000, history: [], now: NOW }));
  expect(first).not.toMatch(/a mais|a menos/);
});

describe('texto da IA só vale com os números dos fatos', () => {
  const f = facts();
  test('mensagens para a IA levam só números e nomes de exercício', () => {
    const [sys, user] = summaryAiMessages(f);
    expect(sys.content).toMatch(/SOMENTE os números/);
    const payload = JSON.parse(user.content);
    expect(payload).toMatchObject({ minutos: 50, volume_kg: 3300, series_de_trabalho: 9, variacao_volume_pct: 10 });
    expect(JSON.stringify(payload)).not.toMatch(/@|uid|email/i);
  });
  test('aceita texto com números dos fatos e recusa número inventado, emoji e texto curto', () => {
    expect(summaryMatchesFacts('Treino forte de 50 minutos, com 3300 kg de volume e 10% a mais que da última vez. Bora manter o ritmo!', f)).toBe(true);
    expect(summaryMatchesFacts('Treino de 50 minutos, com 3500 kg de volume.', f)).toBe(false);
    expect(summaryMatchesFacts('Treino de 50 minutos, parabéns pelo recorde 💪 em tudo.', f)).toBe(false);
    expect(summaryMatchesFacts('Bom treino!', f)).toBe(false);
  });
});
