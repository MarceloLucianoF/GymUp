import { canAuthorTrainings, countByVersion, draftChanged, toDraftExercise, versionIdOf } from './academyTrainingService';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('../data/exercises', () => ({ exercises: [] }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), deleteDoc: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), query: jest.fn(),
  serverTimestamp: jest.fn(), where: jest.fn(), writeBatch: jest.fn()
}));

const ex = { name: 'Agachamento', muscleGroup: 'pernas', sets: '3', reps: '10', rest: 60, machineImage: '' };

test('versionId e contagem de alunos por versão', () => {
  expect(versionIdOf('abc', 2)).toBe('abc_2');
  expect(countByVersion([{ versionId: 'f_1' }, { versionId: 'f_1' }, { versionId: 'f_2' }, {}])).toEqual({ f_1: 2, f_2: 1 });
  expect(countByVersion(null)).toEqual({});
});

test('rascunho com alterações em relação à última versão', () => {
  const series = { draft: { name: 'A', exercises: [ex] } };
  expect(draftChanged(series, null)).toBe(true);
  expect(draftChanged({ draft: { name: 'A', exercises: [] } }, null)).toBe(false);
  expect(draftChanged(series, { name: 'A', exercises: [{ ...ex }] })).toBe(false);          // mesma ordem de chaves ou não
  expect(draftChanged(series, { name: 'A', exercises: [{ ...ex, reps: '12' }] })).toBe(true);
  expect(draftChanged(series, { name: 'B', exercises: [ex] })).toBe(true);
});

test('só dono, admin e professor com permissão criam ficha', () => {
  expect(canAuthorTrainings({ status: 'active', role: 'owner' })).toBe(true);
  expect(canAuthorTrainings({ status: 'active', role: 'admin' })).toBe(true);
  expect(canAuthorTrainings({ status: 'active', role: 'teacher' })).toBe(false);
  expect(canAuthorTrainings({ status: 'active', role: 'teacher', perms: { createTrainings: true } })).toBe(true);
  expect(canAuthorTrainings({ status: 'suspended', role: 'owner' })).toBe(false);
  expect(canAuthorTrainings({ status: 'active', role: 'student' })).toBe(false);
  expect(canAuthorTrainings(null)).toBe(false);
});

test('exercício vira cópia enxuta da biblioteca, com limites', () => {
  const out = toDraftExercise({ name: 'Leg Press', muscleGroup: 'pernas', machineImage: '/exercises/leg-press.gif', rest: 999 }, {});
  expect(out).toEqual({ name: 'Leg Press', muscleGroup: 'pernas', sets: '3', reps: '8-12', rest: 300, machineImage: '/exercises/leg-press.gif' });
  expect(toDraftExercise({ name: 'X' }, { sets: '5', reps: '6', rest: 90 })).toMatchObject({ sets: '5', reps: '6', rest: 90 });
});
