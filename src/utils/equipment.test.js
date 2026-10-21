import { equipmentOf, equipmentOptions, filterByEquipment, isAvailable, sanitizeEquipment, describeEquipment } from './equipment';
import { exercises } from '../data/exercises';
import { applyEquipmentConstraint, normalizeLibrary } from './workoutComposer';

test('campo explícito manda; sem campo, deduz pelo nome; rótulos livres do editor viram valores padrão', () => {
  expect(equipmentOf({ name: 'Qualquer', equipment: 'halter' })).toBe('halter');
  expect(equipmentOf({ name: 'Supino', equipment: 'Halteres' })).toBe('halter');
  expect(equipmentOf({ name: 'Supino', equipment: 'Máquina' })).toBe('maquina');
  expect(equipmentOptions({ name: 'X', equipment: ['barra', 'maquina'] })).toEqual(['barra', 'maquina']);
  expect(equipmentOf({ name: 'Rosca Direta Barra' })).toBe('barra');
  expect(equipmentOf({ name: 'Esteira / Bike / Escada' })).toBe('cardio');
  expect(equipmentOf({ name: 'Flexão de braço' })).toBe('livre');
});

test('perfil sem escolha vê tudo; com escolha, só o que consegue executar (alternativas valem)', () => {
  const lib = [{ name: 'A', equipment: 'maquina' }, { name: 'B', equipment: 'halter' }, { name: 'C', equipment: ['barra', 'maquina'] }, { name: 'D', equipment: 'livre' }];
  expect(filterByEquipment(lib, undefined)).toHaveLength(4);
  expect(filterByEquipment(lib, [])).toHaveLength(4);
  expect(filterByEquipment(lib, ['halter', 'livre']).map((e) => e.name)).toEqual(['B', 'D']);
  expect(filterByEquipment(lib, ['maquina']).map((e) => e.name)).toEqual(['A', 'C']);
  expect(isAvailable(lib[2], ['barra'])).toBe(true);
  expect(sanitizeEquipment(['halter', 'halter', 'laser', 5])).toEqual(['halter']);
  expect(describeEquipment([])).toBe('todos os equipamentos');
  expect(describeEquipment(['halter', 'livre'])).toBe('halteres, peso do corpo');
});

describe('biblioteca embutida', () => {
  test('todo exercício tem equipamento explícito e válido', () => {
    for (const e of exercises) {
      const raw = Array.isArray(e.equipment) ? e.equipment : [e.equipment];
      expect(raw.length).toBeGreaterThan(0);
      raw.forEach((v) => expect(['maquina', 'polia', 'halter', 'barra', 'livre', 'cardio']).toContain(v));
    }
  });
  test('quem só tem halteres e peso do corpo ainda tem o que treinar em cada grupo principal', () => {
    const lib = filterByEquipment(exercises, ['halter', 'livre']);
    const groups = new Set(lib.map((e) => e.muscleGroup));
    ['peito', 'costas', 'ombro', 'biceps', 'triceps', 'perna', 'core'].forEach((g) => expect(groups.has(g)).toBe(true));
  });
  test('o que só usa máquina some da lista de quem não tem máquina', () => {
    const lib = filterByEquipment(exercises, ['halter']);
    expect(lib.some((e) => /Leg Press|Mesa Flexora|Peck Deck/.test(e.name))).toBe(false);
  });
  test('restrição "somente máquina" do pedido continua funcionando com o campo explícito', () => {
    const only = applyEquipmentConstraint(normalizeLibrary(exercises), { only: ['maquina', 'polia'], without: [] });
    expect(only.length).toBeGreaterThan(25);
    expect(only.every((e) => ['maquina', 'polia'].includes(e.equipment))).toBe(true);
  });
});
