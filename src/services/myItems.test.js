import { buildMyWorkout } from './myWorkouts';
import { buildMyExercise, myExerciseToLibrary } from './myExercises';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ addDoc: jest.fn(), collection: jest.fn(), deleteDoc: jest.fn(), doc: jest.fn(), getDocs: jest.fn(), orderBy: jest.fn(), query: jest.fn(), serverTimestamp: jest.fn(), setDoc: jest.fn() }));

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

describe('buildMyWorkout', () => {
  test('mantém a data de criação na edição e só aceita foto JPEG gerada pelo app', () => {
    const w = buildMyWorkout({ name: ' Treino ', exercises: [{ name: 'A' }], photo: JPEG, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(w.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(w.photo).toBe(JPEG);
    expect(w.name).toBe('Treino');
    expect(buildMyWorkout({ name: 'X', exercises: [{ name: 'A' }], photo: 'data:image/svg+xml;base64,PHN2Zz4=' }).photo).toBeUndefined();
    expect(buildMyWorkout({ name: 'X', exercises: [{ name: 'A' }], photo: 'https://golpe.com/a.jpg' }).photo).toBeUndefined();
  });
  test('imagem de exercício: só caminho da biblioteca ou foto própria; link externo e SVG caem', () => {
    const w = buildMyWorkout({ name: 'X', exercises: [
      { name: 'a', machineImage: '/exercises/supino.gif' }, { name: 'b', machineImage: JPEG }, { name: 'c', machineImage: 'https://golpe.com/x.gif' },
      { name: 'd', machineImage: 'data:image/svg+xml;base64,PHN2Zz4=' }, { name: 'e', machineImage: 'javascript:alert(1)' }
    ] });
    expect(w.exercises.map((e) => e.machineImage)).toEqual(['/exercises/supino.gif', JPEG, null, null, null]);
  });
});

describe('warmupStretch nos treinos pessoais', () => {
  const firestore = require('firebase/firestore');
  const { saveMyWorkout } = require('./myWorkouts');
  beforeEach(() => { firestore.addDoc.mockReset(); });

  test('só grava o campo quando é booleano', () => {
    expect(buildMyWorkout({ name: 'X', exercises: [{ name: 'A' }], warmupStretch: true }).warmupStretch).toBe(true);
    expect(buildMyWorkout({ name: 'X', exercises: [{ name: 'A' }], warmupStretch: false }).warmupStretch).toBe(false);
    expect('warmupStretch' in buildMyWorkout({ name: 'X', exercises: [{ name: 'A' }] })).toBe(false);
  });

  test('regras ainda sem o campo: grava de novo sem ele em vez de perder o treino', async () => {
    firestore.addDoc.mockRejectedValueOnce(Object.assign(new Error('negado'), { code: 'permission-denied' })).mockResolvedValueOnce({ id: 'abc' });
    await expect(saveMyWorkout('u1', { name: 'X', exercises: [{ name: 'A' }], warmupStretch: true })).resolves.toBe('my_abc');
    expect(firestore.addDoc).toHaveBeenCalledTimes(2);
    expect(firestore.addDoc.mock.calls[0][1].warmupStretch).toBe(true);
    expect('warmupStretch' in firestore.addDoc.mock.calls[1][1]).toBe(false);
  });

  test('outro erro não é mascarado', async () => {
    firestore.addDoc.mockRejectedValueOnce(Object.assign(new Error('fora do ar'), { code: 'unavailable' }));
    await expect(saveMyWorkout('u1', { name: 'X', exercises: [{ name: 'A' }], warmupStretch: true })).rejects.toThrow('fora do ar');
    expect(firestore.addDoc).toHaveBeenCalledTimes(1);
  });
});

describe('buildMyExercise', () => {
  test('normaliza tipo, grupo, equipamento e limita tamanhos', () => {
    const e = buildMyExercise({ name: '  Remada do condomínio  ', kind: 'magica', muscleGroup: 'cabelo', equipment: 'laser', sets: 99, reps: '8-12', rest: 9999, note: 'x'.repeat(300), photo: JPEG });
    expect(e).toMatchObject({ name: 'Remada do condomínio', kind: 'strength', muscleGroup: 'peito', equipment: 'livre', sets: '12', reps: '8-12', rest: 600 });
    expect(e.note).toHaveLength(160);
    expect(e.photo).toBe(JPEG);
  });
  test('cardio não tem séries nem descanso; foto fora do padrão é descartada', () => {
    const e = buildMyExercise({ name: 'Bike da sala', kind: 'cardio', muscleGroup: 'cardio', equipment: 'cardio', reps: '30', rest: 60, photo: 'https://x.com/a.jpg' });
    expect(e).toMatchObject({ kind: 'cardio', sets: '1', reps: '30', rest: 0 });
    expect(e.photo).toBeUndefined();
  });
  test('vira exercício da biblioteca com a foto como imagem', () => {
    const lib = myExerciseToLibrary({ id: 'mine_1', name: 'Remada', muscleGroup: 'costas', equipment: 'halter', kind: 'strength', sets: '3', reps: '10', rest: 60, note: 'banco 3', photo: JPEG });
    expect(lib).toMatchObject({ id: 'mine_1', mine: true, machineImage: JPEG, description: 'banco 3', sets: 3 });
  });
});
