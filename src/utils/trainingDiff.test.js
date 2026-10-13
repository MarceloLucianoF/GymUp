import { diffVersions } from './trainingDiff';

const ex = (name, sets = '3', reps = '10', rest = 60) => ({ name, sets, reps, rest });

describe('diffVersions', () => {
  test('versões iguais são idênticas', () => {
    const v = { name: 'Perna', exercises: [ex('Agachamento'), ex('Leg Press')] };
    expect(diffVersions(v, { ...v }).identical).toBe(true);
  });

  test('exercícios adicionados e removidos (nome sem acento/caixa casa)', () => {
    const a = { name: 'Perna', exercises: [ex('Agachamento'), ex('Cadeira Extensora'), ex('Panturrilha')] };
    const b = { name: 'Perna', exercises: [ex('agachamento'), ex('Leg Press'), ex('Panturrilha')] };
    const d = diffVersions(a, b);
    expect(d.added.map((x) => x.name)).toEqual(['Leg Press']);
    expect(d.removed.map((x) => x.name)).toEqual(['Cadeira Extensora']);
    expect(d.moved).toEqual([]);
    expect(d.identical).toBe(false);
  });

  test('mudança de ordem: um exercício que sobe aparece como movido, não todos os demais', () => {
    const a = { name: 'P', exercises: [ex('A'), ex('B'), ex('C'), ex('D')] };
    const b = { name: 'P', exercises: [ex('D'), ex('A'), ex('B'), ex('C')] };
    const d = diffVersions(a, b);
    expect(d.moved).toEqual([{ name: 'D', from: 4, to: 1 }]);
  });

  test('ordem ignora exercícios adicionados/removidos no meio', () => {
    const a = { name: 'P', exercises: [ex('A'), ex('B'), ex('C')] };
    const b = { name: 'P', exercises: [ex('A'), ex('X'), ex('B'), ex('C')] };
    expect(diffVersions(a, b).moved).toEqual([]);
  });

  test('séries, repetições e descanso alterados', () => {
    const a = { name: 'P', exercises: [ex('A', '3', '10', 60), ex('B')] };
    const b = { name: 'P', exercises: [ex('A', '4', '8-12', 90), ex('B')] };
    const d = diffVersions(a, b);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0].changes.map((c) => [c.field, c.from, c.to])).toEqual([['sets', '3', '4'], ['reps', '10', '8-12'], ['rest', '60', '90']]);
  });

  test('nome e descrição (ausente equivale a vazio)', () => {
    const d = diffVersions({ name: 'Perna A', exercises: [] }, { name: 'Perna B', description: 'Foco em quadríceps', exercises: [] });
    expect(d.nameChange).toEqual({ from: 'Perna A', to: 'Perna B' });
    expect(d.descriptionChange).toEqual({ from: '', to: 'Foco em quadríceps' });
    expect(diffVersions({ name: 'X', exercises: [] }, { name: 'X', description: '', exercises: [] }).identical).toBe(true);
  });

  test('exercício repetido na ficha não colide', () => {
    const a = { name: 'P', exercises: [ex('A'), ex('A')] };
    const b = { name: 'P', exercises: [ex('A')] };
    expect(diffVersions(a, b).removed).toHaveLength(1);
  });
});
