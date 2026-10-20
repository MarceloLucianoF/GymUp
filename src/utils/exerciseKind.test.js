import { cardioMinutes, defaultsForKind, exerciseKind, prescriptionLabel, sameDifficulty } from './exerciseKind';

test('reconhece o tipo pelo campo, pelo grupo e pelo nome', () => {
  expect(exerciseKind({ kind: 'timed', name: 'X' })).toBe('timed');
  expect(exerciseKind({ name: 'Esteira / Bike / Escada', muscleGroup: 'cardio' })).toBe('cardio');
  expect(exerciseKind({ name: 'Prancha Abdominal', muscleGroup: 'core' })).toBe('timed');
  expect(exerciseKind({ name: 'Supino Reto', muscleGroup: 'peito' })).toBe('strength');
  expect(exerciseKind({ name: 'Remada curvada' })).toBe('strength');
});

test('meta por tipo: nunca "10 repetições de esteira" nem "3 x 0"', () => {
  expect(prescriptionLabel({ name: 'Esteira', reps: 0 })).toBe('20 min');
  expect(prescriptionLabel({ name: 'Esteira', reps: '25' })).toBe('25 min');
  expect(prescriptionLabel({ name: 'Prancha', sets: 3, reps: 0 })).toBe('3 x 30 s');
  expect(prescriptionLabel({ name: 'Prancha', sets: '3', reps: '45' })).toBe('3 x 45 s');
  expect(prescriptionLabel({ name: 'Supino', sets: '4', reps: '8-12' })).toBe('4 x 8-12');
  expect(prescriptionLabel({ name: 'Supino', sets: 3, reps: 0 })).toBe('3 x 10');
  expect(cardioMinutes({ durationMin: 15, reps: '1' })).toBe(15);
});

test('padrões por tipo e dificuldade sem acento', () => {
  expect(defaultsForKind('cardio')).toEqual({ sets: '1', reps: '25', rest: 0 });
  expect(defaultsForKind('strength').reps).toBe('10');
  expect(sameDifficulty('avancado', 'Avançado')).toBe(true);
  expect(sameDifficulty('iniciante', 'Intermediário')).toBe(false);
});
