import { guideReasons, parseEmphasis, parseExerciseCount, pickBySlots, subOf, termsOf } from './exerciseSlots';
import { exercises } from '../data/exercises';
import { canonicalGroup } from './workoutComposer';

const of = (group) => exercises.filter((e) => canonicalGroup(e.muscleGroup) === group);
const subs = (group, list) => list.map((e) => subOf(group, e.name));
const count = (arr, v) => arr.filter((x) => x === v).length;

test('região/padrão pelo nome', () => {
  expect(subOf('peito', 'Supino Inclinado Halter')).toBe('superior');
  expect(subOf('peito', 'Supino Declinado Máquina')).toBe('inferior');
  expect(subOf('peito', 'Crossover na Polia')).toBe('isolador');
  expect(subOf('peito', 'Chest Press Convergente')).toBe('medio');
  expect(subOf('costas', 'Barra Fixa (Em pé)')).toBe('vertical');
  expect(subOf('costas', 'Remada Cavalinho Máquina')).toBe('remada');
  expect(subOf('costas', 'Pullover Máquina')).toBe('isolador');
  expect(subOf('ombros', 'Elevação Lateral')).toBe('lateral');
});

test('6 de costas com a biblioteca real: puxada vertical, 2+ remadas e isolador, compostos primeiro', () => {
  const back = pickBySlots(of('costas'), 'costas', 6);
  const s = subs('costas', back);
  expect(back).toHaveLength(6);
  expect(count(s, 'vertical')).toBeGreaterThanOrEqual(1);
  expect(count(s, 'remada')).toBeGreaterThanOrEqual(2);
  expect(count(s, 'isolador')).toBeGreaterThanOrEqual(1);
  expect(subOf('costas', back[back.length - 1].name)).toBe('isolador');
  expect(new Set(back.map((e) => e.name)).size).toBe(6);
});

test('ênfase muda as vagas: costas largura tem mais puxadas; peito superior começa no inclinado', () => {
  const wide = subs('costas', pickBySlots(of('costas'), 'costas', 6, { emphasis: 'costas_largura' }));
  const thick = subs('costas', pickBySlots(of('costas'), 'costas', 6, { emphasis: 'costas_espessura' }));
  expect(count(wide, 'vertical')).toBeGreaterThan(count(thick, 'vertical'));
  expect(count(thick, 'remada')).toBeGreaterThan(count(wide, 'remada'));
  const chest = pickBySlots(of('peito'), 'peito', 5, { emphasis: 'peito_superior' });
  expect(subOf('peito', chest[0].name)).toBe('superior');
  expect(count(subs('peito', chest), 'superior')).toBeGreaterThanOrEqual(2);
  const base = subs('peito', pickBySlots(of('peito'), 'peito', 5));
  ['superior', 'medio', 'isolador'].forEach((sub) => expect(base).toContain(sub));
});

test('ênfase e quantidade escritas no texto', () => {
  expect(parseEmphasis('quero focar na parte de cima do peito')).toBe('peito_superior');
  expect(parseEmphasis('costas mais largas')).toBe('costas_largura');
  expect(parseEmphasis('treino de perna')).toBeNull();
  expect(parseExerciseCount('quero 8 exercícios')).toBe(8);
  expect(parseExerciseCount('quero 30 exercícios')).toBeNull();
  expect(termsOf('Supino reto, agachamento livre e leg; x')).toEqual(['supino reto', 'agachamento livre', 'leg']);
});

test('validação do guia: ficha de costas sem puxada vertical é recusada', () => {
  const lib = of('costas').map((e) => ({ ...e, primaryGroup: 'costas' }));
  const reference = pickBySlots(lib, 'costas', 5);
  const onlyRows = lib.filter((e) => subOf('costas', e.name) === 'remada').slice(0, 5);
  expect(guideReasons(onlyRows, reference)).toContain('minimo_costas_vertical');
  expect(guideReasons(reference, reference)).toEqual([]);
  // corpo todo (1 exercício de costas) não cobra mínimos
  expect(guideReasons([onlyRows[0]], [reference[0]])).toEqual([]);
});
