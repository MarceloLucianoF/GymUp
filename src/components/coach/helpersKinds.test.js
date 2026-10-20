import { estimateWorkout } from './helpers';
import { applyPreset } from '../../utils/coachWorkout';

test('estimativa da ficha: cardio entra por minutos e prancha por segundos, não por séries e repetições', () => {
  const only = estimateWorkout([{ name: 'Esteira', kind: 'cardio', reps: '30', sets: '1', rest: 0 }]);
  expect(only).toEqual({ sets: 0, reps: 0, minutes: 30 });
  const mix = estimateWorkout([{ name: 'Supino', sets: 3, reps: '10', rest: 60 }, { name: 'Prancha', kind: 'timed', sets: 3, reps: '30', rest: 30 }]);
  expect(mix.sets).toBe(6);
  expect(mix.reps).toBe(30);   // só a musculação conta repetições
  expect(mix.minutes).toBe(Math.round((3 * 40 + 3 * 60 + 3 * (30 + 30)) / 60));
});

test('modelo de série e repetição não sobrescreve cardio nem prancha', () => {
  const preset = { sets: 4, reps: '8', rest: 90 };
  expect(applyPreset({ name: 'Supino' }, preset)).toMatchObject({ sets: 4, reps: '8', rest: 90 });
  expect(applyPreset({ name: 'Esteira', kind: 'cardio', reps: '25' }, preset)).toMatchObject({ reps: '25' });
  expect(applyPreset({ name: 'Prancha', kind: 'timed', reps: '30' }, preset)).toMatchObject({ reps: '30' });
});
