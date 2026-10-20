import { buildStretchWorkout, isStretchRequest } from './stretchWorkout';
import { exercises } from '../data/exercises';
import { aiService } from '../services/aiService';

test('reconhece pedido de alongamento e mobilidade', () => {
  expect(isStretchRequest('Monte um treino de alongamento')).toBe(true);
  expect(isStretchRequest('quero um aquecimento antes do treino')).toBe(true);
  expect(isStretchRequest('treino de peito')).toBe(false);
});

test('sequência de alongamento usa só exercícios do grupo mobilidade, por tempo, com GIF', () => {
  const w = buildStretchWorkout(exercises);
  expect(w.exercises).toHaveLength(8);
  w.exercises.forEach((e) => { expect(e.kind).toBe('timed'); expect(Number(e.reps)).toBeGreaterThanOrEqual(20); expect(e.machineImage).toMatch(/\.gif$/); });
  expect(w.exercises[0].name).toMatch(/Gato|Criança/);   // começa pela coluna
  expect(buildStretchWorkout([{ name: 'Supino', muscleGroup: 'peito' }])).toBeNull();
});

test('o gerador entrega a sequência quando o pedido é de alongamento, sem músculo específico', () => {
  const w = aiService.generateLocalWorkout({ userRequest: 'Monte um treino de alongamento' });
  expect(w.name).toBe('Alongamento e mobilidade');
  expect(w.composition.source).toBe('regras');
});
