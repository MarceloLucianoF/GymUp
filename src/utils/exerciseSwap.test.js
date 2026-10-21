import { buildSwapped, equivalentsFor } from './exerciseSwap';
import { exercises } from '../data/exercises';

const byName = (n) => exercises.find((e) => e.name === n);

test('equivalentes: mesmo grupo e subgrupo, o mais parecido primeiro, sem o próprio exercício', () => {
  const list = equivalentsFor(byName('Supino Reto Máquina'), exercises, {});
  const names = list.map((e) => e.name);
  expect(names.length).toBeGreaterThan(3);
  expect(names).not.toContain('Supino Reto Máquina');
  list.forEach((e) => expect(e.ref.muscleGroup).toBe('peito'));
  expect(list[0].equipment).toBe('Máquina');                       // mesmo equipamento sobe
  expect(list[0].why).toMatch(/mesmo equipamento/);
});

test('respeita os equipamentos da academia e os exercícios já na ficha', () => {
  const noMachine = equivalentsFor(byName('Supino Reto Máquina'), exercises, { owned: ['halter', 'livre'] });
  expect(noMachine.length).toBeGreaterThan(0);
  noMachine.forEach((e) => expect(['Halter', 'Peso do corpo']).toContain(e.equipment));
  const skip = equivalentsFor(byName('Supino Reto Máquina'), exercises, { excludeNames: ['Chest Press Convergente'] }).map((e) => e.name);
  expect(skip).not.toContain('Chest Press Convergente');
});

test('perna: troca dentro do subgrupo (quadríceps não vira posterior)', () => {
  const list = equivalentsFor(byName('Leg Press'), exercises, {});
  const names = list.map((e) => e.name).join('|');
  expect(names).toMatch(/Hack|Extensora|Agachamento/);
  expect(names).not.toMatch(/Flexora|Stiff|Hip Thrust/);
});

test('exercício do aluno entra e ganha ponto', () => {
  const mine = { id: 'mine_1', firestoreId: 'mine_1', name: 'Remada do condomínio', muscleGroup: 'costas', equipment: 'halter', kind: 'strength', sets: 3, reps: 10, rest: 60, mine: true };
  const list = equivalentsFor(byName('Remada Máquina (Sentado)'), [...exercises, mine], {});
  expect(list.some((e) => e.name === 'Remada do condomínio' && /seu exercício/.test(e.why))).toBe(true);
});

test('cardio só troca por cardio', () => {
  const list = equivalentsFor(byName('Esteira / Bike / Escada'), exercises, {});
  expect(list.length).toBeGreaterThan(3);
  list.forEach((e) => expect(e.ref.muscleGroup).toBe('cardio'));
});

test('exercício novo mantém a prescrição, o plano de séries e o superset do original', () => {
  const original = { name: 'Supino Reto Máquina', sets: '4', reps: '6-10', rest: 90, setTypes: ['warmup', 'normal', 'normal', 'drop'], superset: 'A', note: 'banco 3' };
  const swapped = buildSwapped(original, byName('Chest Press Convergente'));
  expect(swapped).toMatchObject({ name: 'Chest Press Convergente', sets: '4', reps: '6-10', rest: 90, setTypes: ['warmup', 'normal', 'normal', 'drop'], superset: 'A', note: 'banco 3', swappedFrom: 'Supino Reto Máquina' });
  expect(swapped.machineImage).toMatch(/\.gif$/);
  expect(buildSwapped({ name: 'A', sets: '3', reps: '10', rest: 60 }, byName('Prancha Abdominal')).kind).toBe('timed');
});
