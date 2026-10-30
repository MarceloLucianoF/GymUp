import { afterSetAction, assignSupersetLetters, comboLabel, countsAsWork, hasPlan, nextSetType, normalizeSetTypes, planSummary, supersetLinks, supersetRole } from './setTypes';

test('normaliza o plano para o número de séries e troca valor inválido por normal', () => {
  expect(normalizeSetTypes(['warmup', 'laser', 'drop'], 4)).toEqual(['warmup', 'normal', 'drop', 'normal']);
  expect(normalizeSetTypes(undefined, 3)).toEqual(['normal', 'normal', 'normal']);
  expect(normalizeSetTypes(['drop', 'drop', 'drop'], 2)).toEqual(['drop', 'drop']);
  expect(normalizeSetTypes(['drop'], 99)).toHaveLength(12);
});

test('o toque troca o tipo em ciclo e aquecimento não conta como trabalho', () => {
  expect(['normal', 'warmup', 'drop', 'failure', 'cluster', 'normal'].map((t, i, a) => (i < 5 ? nextSetType(t) === a[i + 1] : true)).every(Boolean)).toBe(true);
  expect(countsAsWork('warmup')).toBe(false);
  ['normal', 'drop', 'failure'].forEach((t) => expect(countsAsWork(t)).toBe(true));
});

test('resumo do plano', () => {
  expect(planSummary(['normal', 'normal', 'normal'])).toBe('');
  expect(planSummary(['warmup', 'normal', 'normal', 'drop'])).toBe('Aquec. + 2 normais + Drop');
  expect(planSummary(['normal', 'failure'])).toBe('1 normal + Falha');
  expect(planSummary(['drop', 'drop', 'drop'])).toBe('3 Drop');
  expect(planSummary(['warmup', 'warmup', 'normal', 'normal', 'failure'])).toBe('2 Aquec. + 2 normais + Falha');
  expect(hasPlan(['normal'])).toBe(false);
  expect(hasPlan(['normal', 'drop'])).toBe(true);
});

describe('superset', () => {
  const ex = [{ name: 'A1', superset: 'A' }, { name: 'A2', superset: 'A' }, { name: 'B' }, { name: 'C1', superset: 'B' }, { name: 'C2', superset: 'B' }, { name: 'C3', superset: 'B' }, { name: 'sozinho', superset: 'C' }];
  test('papel de cada exercício no grupo; letra sozinha não vale', () => {
    expect(supersetRole(ex, 0)).toMatchObject({ group: 'A', first: true, last: false, nextIndex: 1, firstIndex: 0, size: 2 });
    expect(supersetRole(ex, 1)).toMatchObject({ first: false, last: true, nextIndex: null, firstIndex: 0 });
    expect(supersetRole(ex, 2)).toBeNull();
    expect(supersetRole(ex, 4)).toMatchObject({ first: false, last: false, nextIndex: 5, size: 3 });
    expect(supersetRole(ex, 6)).toBeNull();
  });
  test('ao concluir série: sem descanso até o último do grupo, depois descansa e volta ao primeiro', () => {
    expect(afterSetAction(ex, 0, 0, 3)).toEqual({ rest: false, goTo: 1 });
    expect(afterSetAction(ex, 1, 0, 3)).toEqual({ rest: true, goTo: 0 });
    expect(afterSetAction(ex, 1, 1, 3)).toEqual({ rest: true, goTo: 0 });
    expect(afterSetAction(ex, 1, 2, 3)).toEqual({ rest: true, goTo: null });   // última série: segue o fluxo normal
    expect(afterSetAction(ex, 2, 0, 3)).toEqual({ rest: true, goTo: null });   // fora de superset: igual a antes
  });
  test('marcas do editor viram letras em sequência e voltam', () => {
    const links = [true, false, false, true, true, false, false];
    const letters = assignSupersetLetters(links);
    expect(letters).toEqual(['A', 'A', null, 'B', 'B', 'B', null]);
    expect(supersetLinks(letters.map((l) => ({ superset: l })))).toEqual(links);
    expect(assignSupersetLetters([true])).toEqual([null]);   // o último não liga a ninguém
    expect(assignSupersetLetters([false, false])).toEqual([null, null]);
  });
});

test('rótulo de exercícios combinados pelo tamanho do grupo', () => {
  expect(comboLabel(2)).toBe('Bi-set');
  expect(comboLabel(3)).toBe('Tri-set');
  expect(comboLabel(4)).toBe('Circuito');
  expect(comboLabel(6)).toBe('Circuito');
  expect(comboLabel(undefined)).toBe('Exercícios combinados');
});
