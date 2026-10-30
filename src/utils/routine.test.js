import { normalizeRoutine, routineLetter, routineNext, sortByRoutine } from './routine';

const w = (docId, name) => ({ id: `my_${docId}`, docId, name, exercises: [{}, {}], estimatedTime: '40 min' });
const workouts = [w('c', 'Pernas'), w('a', 'Peito'), w('b', 'Costas'), w('x', 'Avulso')];
const items = [{ workoutId: 'a' }, { workoutId: 'b' }, { workoutId: 'c' }];
// quarta-feira, 21/10/2026, 15h (fuso de Brasília)
const WED = new Date('2026-10-21T15:00:00-03:00').getTime();

test('letras: A..Z e depois número', () => {
  expect(routineLetter(0)).toBe('A');
  expect(routineLetter(2)).toBe('C');
  expect(routineLetter(26)).toBe('27');
});

test('normaliza: tira repetidos, apagados e dia inválido', () => {
  expect(normalizeRoutine([{ workoutId: 'a', day: 2 }, { workoutId: 'a' }, { workoutId: 'zz' }, { workoutId: 'b', day: 9 }, null], workouts))
    .toEqual([{ workoutId: 'a', day: 2 }, { workoutId: 'b', day: null }]);
  expect(normalizeRoutine(undefined)).toEqual([]);
});

test('ordena Meus treinos pela ficha; os de fora vêm depois, na ordem original', () => {
  const sorted = sortByRoutine(workouts, items);
  expect(sorted.map((t) => t.docId)).toEqual(['a', 'b', 'c', 'x']);
  expect(sorted.map((t) => t.routineLetter)).toEqual(['A', 'B', 'C', undefined]);
  expect(sortByRoutine(workouts, []).map((t) => t.docId)).toEqual(['c', 'a', 'b', 'x']);
});

test('sem histórico começa pelo A; depois do A vem o B; depois do último volta ao A', () => {
  expect(routineNext({ items: [], workouts, now: WED })).toBeNull();
  const start = routineNext({ items, workouts, history: [], now: WED });
  expect(start.mode).toBe('start');
  expect(start.target.letter).toBe('A');

  const afterA = routineNext({ items, workouts, history: [{ trainingId: 'my_a', date: '2026-10-21T08:00:00-03:00' }], now: WED });
  expect(afterA.mode).toBe('sequence');
  expect(afterA.target).toMatchObject({ letter: 'B', id: 'my_b' });
  expect(afterA.last.letter).toBe('A');
  expect(afterA.trainedToday).toBe(true);

  const afterC = routineNext({ items, workouts, history: [
    { trainingId: 'my_c', date: '2026-10-20T08:00:00-03:00' },
    { trainingId: 'my_a', date: '2026-10-18T08:00:00-03:00' },
    { trainingId: 'outro', date: '2026-10-21T08:00:00-03:00' }
  ], now: WED });
  expect(afterC.target.letter).toBe('A');
  expect(afterC.trainedToday).toBe(false);
});

test('com dia marcado: o de hoje vem primeiro; todos com dia → próximo dia da semana', () => {
  const days = [{ workoutId: 'a', day: 0 }, { workoutId: 'b', day: 2 }, { workoutId: 'c', day: 4 }];
  const today = routineNext({ items: days, workouts, history: [], now: WED });
  expect(today.mode).toBe('today');
  expect(today.target.letter).toBe('B');

  const done = routineNext({ items: days, workouts, history: [{ trainingId: 'my_b', date: '2026-10-21T09:00:00-03:00' }], now: WED });
  expect(done.mode).toBe('day');
  expect(done.target).toMatchObject({ letter: 'C', dayLabel: 'Sexta' });

  const sat = new Date('2026-10-24T10:00:00-03:00').getTime();
  expect(routineNext({ items: days, workouts, history: [], now: sat }).target.letter).toBe('A');

  // mistura: só o dia de hoje é fixo; sem treino hoje, segue a sequência
  const mixed = [{ workoutId: 'a' }, { workoutId: 'b', day: 2 }, { workoutId: 'c' }];
  expect(routineNext({ items: mixed, workouts, history: [], now: WED }).target.letter).toBe('B');
  const thu = new Date('2026-10-22T10:00:00-03:00').getTime();
  expect(routineNext({ items: mixed, workouts, history: [{ trainingId: 'my_b', date: '2026-10-21T09:00:00-03:00' }], now: thu }).target.letter).toBe('C');
});
