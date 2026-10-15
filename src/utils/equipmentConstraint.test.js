import { applyEquipmentConstraint, normalizeLibrary, parseEquipmentConstraint } from './workoutComposer';
import { aiService } from '../services/aiService';
import { exercises as defaultExercises } from '../data/exercises';

describe('restrição de equipamento no pedido', () => {
  test('reconhece somente / sem', () => {
    expect(parseEquipmentConstraint('Quero montar um treino personalizado, mas somente com peso em maquina').only).toContain('maquina');
    expect(parseEquipmentConstraint('mas somente com peso sem maquina')).toEqual({ only: [], without: ['maquina'] });
    expect(parseEquipmentConstraint('so halter por favor').only).toEqual(['halter']);
    expect(parseEquipmentConstraint('treino de peito')).toBeNull();
  });

  test('somente máquina: ficha só com máquinas/polias, sem halter, barra ou peso livre', () => {
    const w = aiService.generateLocalWorkout({ userRequest: 'treino full body somente maquina', goal: 'Emagrecimento' });
    const lib = normalizeLibrary(defaultExercises);
    const eq = (n) => lib.find((e) => e.name === n)?.equipment;
    expect(w.exercises.length).toBeGreaterThanOrEqual(3);
    w.exercises.forEach((ex) => expect(['maquina', 'polia']).toContain(eq(ex.name)));
  });

  test('sem máquina: nenhuma máquina na ficha', () => {
    const lib = normalizeLibrary(defaultExercises);
    const w = aiService.generateLocalWorkout({ userRequest: 'treino de peito sem maquina' });
    w.exercises.forEach((ex) => expect(lib.find((e) => e.name === ex.name)?.equipment).not.toBe('maquina'));
    expect(applyEquipmentConstraint(lib, null)).toBe(lib);
  });
});
