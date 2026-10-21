import { generateWeekPlan, resolvePlanText } from './weekPlanService';
import { InsufficientExercisesError } from '../utils/workoutComposer';

jest.mock('../firebase/config', () => ({ auth: { currentUser: null }, db: {} }));

const workoutOf = (focus, names) => ({ name: focus, exercises: names.map((n, i) => ({ firestoreId: `ex${i}`, name: n, sets: '3', reps: '8-12', rest: 60 })) });
const fakeAi = (impl) => ({ generateAIWorkout: jest.fn(impl), generateLocalWorkout: jest.fn((a) => workoutOf(a.muscleFocus, ['L1', 'L2', 'L3', 'L4', 'L5'])), summarizeFacts: jest.fn() });

test('monta um dia para cada treino da divisão, nos dias certos, e avisa o progresso', async () => {
  const ai = fakeAi(async (a) => workoutOf(a.muscleFocus, [`${a.muscleFocus} 1`, `${a.muscleFocus} 2`, `${a.muscleFocus} 3`, `${a.muscleFocus} 4`, `${a.muscleFocus} 5`]));
  const progress = [];
  const plan = await generateWeekPlan({ days: 4, goal: 'Hipertrofia', experience: 'intermediario', durationMinutes: 45, equipment: ['halter'], ai, onProgress: (p) => progress.push(p.done) });
  expect(plan.days.map((d) => [d.weekday, d.focus])).toEqual([[0, 'Peito e Tríceps'], [1, 'Costas e Bíceps'], [3, 'Pernas Completo'], [4, 'Ombros e ABS']]);
  expect(ai.generateAIWorkout).toHaveBeenCalledTimes(4);
  expect(ai.generateAIWorkout.mock.calls[0][0]).toMatchObject({ goal: 'Hipertrofia', durationMinutes: 45, equipment: ['halter'] });
  expect(progress).toEqual([1, 2, 3, 4]);
  expect(plan.warnings).toEqual([]);
});

test('dias do mesmo foco vêm em ondas: o segundo evita o que o primeiro usou', async () => {
  const ai = fakeAi(async (a) => workoutOf(a.muscleFocus, a.excludeNames.length ? ['B1', 'B2', 'B3', 'B4', 'B5'] : ['A1', 'A2', 'A3', 'A4', 'A5']));
  const plan = await generateWeekPlan({ days: 2, ai });
  expect(ai.generateAIWorkout.mock.calls[0][0].excludeNames).toEqual([]);
  expect(ai.generateAIWorkout.mock.calls[1][0].excludeNames).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
  expect(plan.days.map((d) => d.label)).toEqual(['Corpo todo A', 'Corpo todo B']);
});

test('IA que falha ou demora cai no plano local; foco sem exercícios vira aviso e os outros dias seguem', async () => {
  const ai = fakeAi(async (a) => {
    if (a.muscleFocus === 'Costas e Bíceps') throw new InsufficientExercisesError('Poucos exercícios de costas com os seus equipamentos.');
    if (a.muscleFocus === 'Pernas Completo') throw new Error('NVIDIA 503');
    return workoutOf(a.muscleFocus, ['X1', 'X2', 'X3', 'X4', 'X5']);
  });
  const plan = await generateWeekPlan({ days: 4, ai });
  const byFocus = Object.fromEntries(plan.days.map((d) => [d.focus, d]));
  expect(byFocus['Pernas Completo'].workout.exercises[0].name).toBe('L1');           // reserva local
  expect(byFocus['Costas e Bíceps'].workout).toBeNull();
  expect(plan.warnings).toEqual(['Costas e Bíceps: Poucos exercícios de costas com os seus equipamentos.']);
  const slow = fakeAi(() => new Promise(() => {}));
  const p2 = await generateWeekPlan({ days: 2, ai: slow, timeoutMs: 20 });
  expect(p2.days.every((d) => d.workout?.exercises[0].name === 'L1')).toBe(true);
});

test('extras: cardio e alongamento entram em dias livres, sem tocar nos treinos', async () => {
  const ai = fakeAi(async (a) => workoutOf(a.muscleFocus, ['X1', 'X2', 'X3', 'X4', 'X5']));
  const plan = await generateWeekPlan({ days: 3, experience: 'avancado', includeCardio: true, includeStretch: true, ai });
  const kinds = plan.days.map((d) => `${d.weekday}:${d.kind}`);
  expect(plan.days).toHaveLength(5);
  expect(kinds.filter((k) => k.endsWith('strength')).map((k) => k.split(':')[0])).toEqual(['0', '2', '4']);
  expect(plan.days.find((d) => d.kind === 'cardio').workout.name).toMatch(/Cardio/);
  expect(plan.days.find((d) => d.kind === 'stretch').workout.name).toBe('Alongamento e mobilidade');
  expect(new Set(plan.days.map((d) => d.weekday)).size).toBe(5);
});

test('texto da semana: IA validada ou local, nunca lança', async () => {
  const ai = fakeAi(async (a) => workoutOf(a.muscleFocus, ['X1', 'X2', 'X3', 'X4', 'X5']));
  const plan = await generateWeekPlan({ days: 3, experience: 'avancado', durationMinutes: 45, ai });
  ai.summarizeFacts.mockResolvedValueOnce('Você treina 3 vezes na semana, com 45 minutos por treino, e cada dia tem um foco diferente.');
  expect((await resolvePlanText(plan, { ai })).source).toBe('ai');
  ai.summarizeFacts.mockResolvedValueOnce('Você treina 7 vezes na semana, com 45 minutos por treino, sem folga nenhuma.');
  expect((await resolvePlanText(plan, { ai })).source).toBe('local');
  ai.summarizeFacts.mockRejectedValueOnce(new Error('503'));
  expect((await resolvePlanText(plan, { ai })).source).toBe('local');
});
