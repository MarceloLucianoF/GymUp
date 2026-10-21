import { detectNewPRs, hydrateExercises, summarizeSession } from './training';
import { validSets, sessionMetrics } from './analytics';
import { parseImportedWorkout, toWorkoutExercise } from '../services/workoutImport';

describe('série de aquecimento fica fora do volume, das séries de trabalho e dos recordes', () => {
  const exercises = [{ name: 'Supino', muscleGroup: 'peito', sets: '4', setTypes: ['warmup', 'normal', 'normal', 'drop'] }];
  const done = (weight, reps, extra = {}) => ({ completed: true, weight, reps, ...extra });

  test('resumo da sessão: usa o plano da ficha, deixa o aluno trocar e marca o tipo no histórico', () => {
    const session = { '0-0': done('20', '12'), '0-1': done('60', '10'), '0-2': done('60', '8', { type: 'failure' }), '0-3': done('40', '10') };
    const { totalVolume, setsCompleted, executedExercises } = summarizeSession(exercises, session);
    expect(totalVolume).toBe(60 * 10 + 60 * 8 + 40 * 10);        // sem os 20 x 12 do aquecimento
    expect(setsCompleted).toBe(3);                               // 3 séries de trabalho
    expect(executedExercises[0].sets.map((s) => s.type)).toEqual(['warmup', undefined, 'failure', 'drop']);
    expect(executedExercises[0].sets[0]).toMatchObject({ weight: 20, reps: 12, type: 'warmup' });   // o aquecimento continua registrado
  });

  test('sem plano e sem escolha, nada muda para quem já treinava (tudo normal, sem campo type)', () => {
    const { executedExercises, setsCompleted } = summarizeSession([{ name: 'Rosca', sets: '2' }], { '0-0': done('10', '10'), '0-1': done('10', '9') });
    expect(setsCompleted).toBe(2);
    expect(executedExercises[0].sets.every((s) => !('type' in s))).toBe(true);
  });

  test('recorde: aquecimento mais pesado que o histórico não vira recorde', () => {
    const session = { '0-0': done('100', '3', { type: 'warmup' }), '0-1': done('60', '10') };
    expect(detectNewPRs(exercises, session, { Supino: 70 })).toEqual([]);
    expect(detectNewPRs(exercises, { '0-1': done('80', '5') }, { Supino: 70 })).toEqual(['Supino']);
  });

  test('analytics: 1RM, volume e melhor série ignoram aquecimento', () => {
    const sets = [{ weight: 100, reps: 3, completed: true, type: 'warmup' }, { weight: 60, reps: 10, completed: true }, { weight: 60, reps: 8, completed: true, type: 'drop' }];
    expect(validSets(sets)).toHaveLength(2);
    const m = sessionMetrics(sets);
    expect(m.maxWeight).toBe(60);
    expect(m.volume).toBe(60 * 10 + 60 * 8);
  });
});

test('hidratação da ficha ajusta o plano ao número de séries e preserva o superset', () => {
  const [a, b] = hydrateExercises([{ name: 'A', sets: '3', reps: '10', setTypes: ['drop'], superset: 'A' }, { name: 'B', sets: '2', reps: '10', superset: 'A' }], []);
  expect(a.setTypes).toEqual(['drop', 'normal', 'normal']);
  expect(a.superset).toBe('A');
  expect(b.setTypes).toBeUndefined();
});

describe('importação de PDF com tipos de série', () => {
  test('a IA indica drop-set e aquecimento: valores válidos viram plano e inválidos viram normal', () => {
    const raw = JSON.stringify({ name: 'Braço', exercises: [
      { name: 'Rosca Scott Martelo com Halteres', sets: 3, reps: '6-10', rest: 90, setTypes: ['warmup', 'normal', 'drop'] },
      { name: 'Tríceps francês', sets: 3, reps: '12', rest: 60, setTypes: ['laser', 'normal'] },
      { name: 'Esteira', type: 'cardio', minutes: 20, setTypes: ['drop'] }
    ] });
    const w = parseImportedWorkout(raw, []);
    expect(w.exercises[0].setTypes).toEqual(['warmup', 'normal', 'drop']);
    expect(w.exercises[1].setTypes).toBeUndefined();            // só normais: sem plano
    expect(w.exercises[2].setTypes).toBeUndefined();            // cardio não tem tipo de série
    expect(toWorkoutExercise(w.exercises[0], null, 0).setTypes).toEqual(['warmup', 'normal', 'drop']);
  });
});
