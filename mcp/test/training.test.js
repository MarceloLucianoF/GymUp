import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTraining, findUnknownExercises } from '../lib/training.js';

test('normaliza ficha e converte séries/reps para string', () => {
  const t = normalizeTraining({ name: 'A', exercises: [{ name: 'Supino', sets: 4, reps: 10 }] });
  assert.equal(t.exercises[0].sets, '4');
  assert.equal(t.exercises[0].reps, '10');
  assert.equal(t.exercises[0].machineImage, null);
});

test('rejeita ficha sem exercícios ou sem nome', () => {
  assert.throws(() => normalizeTraining({ name: 'A', exercises: [] }));
  assert.throws(() => normalizeTraining({ name: '', exercises: [{ name: 'x', sets: 3, reps: 8 }] }));
});

test('detecta exercícios fora da biblioteca', () => {
  const t = normalizeTraining({ name: 'A', exercises: [{ name: 'Supino', sets: 3, reps: 8 }, { name: 'Inventado', sets: 3, reps: 8 }] });
  assert.deepEqual(findUnknownExercises(t, ['supino']), ['Inventado']);
});
