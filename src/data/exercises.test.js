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
