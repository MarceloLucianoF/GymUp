import { buildCardioWorkout, isCardioRequest } from './cardioWorkout';

test('reconhece pedido aeróbico e não confunde com musculação', () => {
  expect(isCardioRequest('Gere um treino aeróbico de bicicleta e esteira')).toBe(true);
  expect(isCardioRequest('treino de peito e tríceps')).toBe(false);
});

test('monta ficha de esteira e bicicleta com aquecimento, blocos e volta à calma somando o tempo pedido', () => {
  const w = buildCardioWorkout('Gere um treino aeróbico de bicicleta e esteira de 40 minutos', { goal: 'Resistência' });
  const names = w.exercises.map((e) => e.name);
  expect(names[0]).toMatch(/Esteira: caminhada leve \(5 min\)/);
  expect(names.some((n) => /Bicicleta/.test(n))).toBe(true);
  expect(names[names.length - 1]).toMatch(/volta à calma/);
  const sum = w.exercises.reduce((t, e) => t + Number(e.name.match(/\((\d+) min\)/)[1]), 0);
  expect(sum).toBe(40);
  expect(w.exercises.every((e) => e.muscleGroup === 'Cardio')).toBe(true);
  expect(w.name).toMatch(/Cardio/);
  expect(w.composition.source).toBe('regras');
});

test('emagrecimento vira intervalado e sem modalidade usa esteira e bicicleta', () => {
  const w = buildCardioWorkout('quero cardio', { goal: 'Emagrecimento' });
  expect(w.exercises.some((e) => /intervalado/.test(e.name))).toBe(true);
  expect(w.exercises.some((e) => /Bicicleta/.test(e.name))).toBe(true);
});
