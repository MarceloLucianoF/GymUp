import { exerciseKind } from '../utils/exerciseKind';
import fs from 'fs';
import path from 'path';
import { exercises } from './exercises';
import { canonicalGroup, normalizeLibrary } from '../utils/workoutComposer';

const pub = (p) => path.join(__dirname, '../../public', p);

describe('biblioteca embutida de exercícios', () => {
  test('nomes únicos (sem acento ou caixa) e ids únicos', () => {
    const plain = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    expect(new Set(exercises.map((e) => plain(e.name))).size).toBe(exercises.length);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
    expect(normalizeLibrary(exercises)).toHaveLength(exercises.length);
  });

  test('todo exercício tem GIF e foto existentes, texto completo e grupo reconhecido', () => {
    for (const e of exercises) {
      expect(fs.existsSync(pub(e.machineImage))).toBe(true);
      expect(fs.existsSync(pub(e.machineImage.replace('/exercises/', '/exercicios/').replace('.gif', '.jpg')))).toBe(true);
      expect(e.description.length).toBeGreaterThan(30);
      expect(e.execution.length).toBeGreaterThan(60);
      expect(e.sets).toBeGreaterThan(0);
      expect(e.reps).toBeGreaterThan(0);   // repetições, segundos (prancha) ou minutos (cardio): nunca 0
      if (['cardio', 'timed'].includes(e.kind)) expect(e.sets).toBeGreaterThan(0);
      expect(exerciseKind(e) === 'cardio').toBe(/cardio/.test(e.muscleGroup));
      expect(['iniciante', 'intermediário', 'avançado']).toContain(e.difficulty);
      expect(canonicalGroup(e.muscleGroup)).not.toBe('geral');
    }
  });

  test('o filtro "somente máquinas" tem exercícios em todos os grupos principais', () => {
    const lib = normalizeLibrary(exercises).filter((e) => ['maquina', 'polia'].includes(e.equipment));
    for (const g of ['peito', 'costas', 'ombros', 'bracos', 'pernas']) expect(lib.filter((e) => e.primaryGroup === g).length).toBeGreaterThanOrEqual(3);
    expect(lib.filter((e) => e.primaryGroup === 'core').length).toBeGreaterThanOrEqual(2);
  });
});

describe('ampliação do catálogo (ex71 em diante)', () => {
  const novos = exercises.filter((e) => Number(e.id.replace('ex', '')) > 70);
  test('são 50 novos, com ids seguidos e nomes únicos em toda a biblioteca', () => {
    expect(novos).toHaveLength(50);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
    expect(new Set(exercises.map((e) => e.name.toLowerCase())).size).toBe(exercises.length);
  });
  test('alongamento e mobilidade são por tempo, sem carga, e cardio é por minutos', () => {
    novos.filter((e) => e.muscleGroup === 'mobilidade').forEach((e) => { expect(e.kind).toBe('timed'); expect(e.reps).toBeGreaterThanOrEqual(20); expect(e.sets).toBeLessThanOrEqual(3); });
    novos.filter((e) => e.muscleGroup === 'cardio').forEach((e) => { expect(e.kind).toBe('cardio'); expect(e.sets).toBe(1); expect(e.rest).toBe(0); });
    expect(novos.filter((e) => e.muscleGroup === 'mobilidade').length).toBeGreaterThanOrEqual(10);
  });
  test('o gerador de fichas de musculação não usa alongamento nem cardio', () => {
    const lib = normalizeLibrary(exercises).filter((e) => ['mobilidade', 'cardio'].includes(e.primaryGroup));
    expect(lib.length).toBeGreaterThan(15);
    const { composeLocalPlan, specFromFocus } = require('../utils/workoutComposer');
    ['Full Body (Corpo Todo)', 'Peito e Tríceps', 'Pernas Completo'].forEach((focus) => {
      const plan = composeLocalPlan({ spec: specFromFocus(focus), library: normalizeLibrary(exercises), total: 6, goal: 'Hipertrofia' });
      plan.exercises.forEach((e) => expect(['mobilidade', 'cardio']).not.toContain(e.primaryGroup));
    });
  });
  test('quem só tem halteres e peso do corpo agora tem peso livre em todos os grupos principais', () => {
    const { filterByEquipment } = require('../utils/equipment');
    const lib = filterByEquipment(exercises, ['barra']);
    const groups = new Set(lib.map((e) => e.muscleGroup));
    ['peito', 'costas', 'perna', 'triceps', 'biceps'].forEach((g) => expect(groups.has(g)).toBe(true));
  });
});
