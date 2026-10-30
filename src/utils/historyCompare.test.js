import { filterHistory, trainingOptions, exerciseOptions, dayKeyOf, trainingKeyOf } from './historyFilters';
import { findPreviousSession, compareSessions, exerciseVolume, exerciseTopLoad, setVolume } from './sessionCompare';

const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).toISOString();
const history = [
  { id: 'c3', trainingId: 'A', trainingName: 'Treino A', date: at(2026, 10, 28), exercises: [{ name: 'Supino', sets: [] }, { name: 'Remada', sets: [] }] },
  { id: 'c2', trainingId: 'B', trainingName: 'Treino B', date: at(2026, 10, 27), exercises: [{ name: 'Agachamento', sets: [] }] },
  { id: 'c1', trainingId: 'A', trainingName: 'Treino A', date: at(2026, 10, 20), exercises: [{ name: 'supino ', sets: [] }] },
  { id: 'c0', trainingName: 'Antigo', date: at(2026, 9, 5), exercises: [{ name: 'Remada', sets: [] }] },
];

describe('filtros do histórico', () => {
  it('dia do calendário filtra só aquele dia e manda sobre o período', () => {
    const rows = filterHistory(history, { day: dayKeyOf(at(2026, 10, 27)), time: 'last_month' }, new Date(2026, 9, 29));
    expect(rows.map((r) => r.id)).toEqual(['c2']);
  });

  it('por ficha (ID quando houver, nome senão) e por exercício (sem diferenciar maiúsculas e espaços)', () => {
    expect(filterHistory(history, { training: 'id:A' }).map((r) => r.id)).toEqual(['c3', 'c1']);
    expect(filterHistory(history, { training: trainingKeyOf(history[3]) }).map((r) => r.id)).toEqual(['c0']);
    expect(filterHistory(history, { exercise: 'supino' }).map((r) => r.id)).toEqual(['c3', 'c1']);
    expect(filterHistory(history, { exercise: 'remada', training: 'id:A' }).map((r) => r.id)).toEqual(['c3']);
  });

  it('período e busca continuam funcionando', () => {
    const now = new Date(2026, 9, 29);
    expect(filterHistory(history, { time: 'month' }, now)).toHaveLength(3);
    expect(filterHistory(history, { time: 'last_month' }, now).map((r) => r.id)).toEqual(['c0']);
    expect(filterHistory(history, { search: 'agach' }).map((r) => r.id)).toEqual(['c2']);
  });

  it('opções: fichas mais frequentes primeiro; exercícios sem repetir grafia', () => {
    expect(trainingOptions(history)[0]).toMatchObject({ value: 'id:A', label: 'Treino A', count: 2 });
    expect(exerciseOptions(history).map((o) => o.value)).toEqual(['agachamento', 'remada', 'supino']);
  });
});

describe('comparação com a sessão anterior', () => {
  const prev = {
    id: 'p', trainingId: 'A', trainingName: 'Treino A', date: at(2026, 10, 20), totalVolume: 1600,
    exercises: [
      { name: 'Supino', sets: [{ weight: 20, reps: 10, type: 'warmup' }, { weight: 60, reps: 10 }, { weight: 60, reps: 10 }] },
      { name: 'Crucifixo', sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 10 }] },
    ],
  };
  const cur = {
    trainingId: 'A', trainingName: 'Treino A', date: at(2026, 10, 28), totalVolume: 1690,
    exercises: [
      { name: 'Supino', sets: [{ weight: 65, reps: 10 }, { weight: 65, reps: 9 }] },
      { name: 'Remada', sets: [{ weight: 50, reps: 10 }] },
    ],
  };

  it('acha a anterior da mesma ficha, ignorando a própria sessão, outras fichas e sessões depois', () => {
    const list = [{ ...cur, id: 'cur' }, { id: 'x', trainingId: 'B', date: at(2026, 10, 25) }, prev, { id: 'old', trainingId: 'A', date: at(2026, 10, 1) }, { id: 'later', trainingId: 'A', date: at(2026, 10, 29) }];
    expect(findPreviousSession(list, cur, 'cur').id).toBe('p');
    expect(findPreviousSession([{ id: 'n', trainingName: 'treino a', date: at(2026, 10, 2) }], { trainingName: 'Treino A', date: at(2026, 10, 28) }).id).toBe('n');
    expect(findPreviousSession([], cur)).toBeNull();
  });

  it('volume sem aquecimento, partes de drop somadas e maior carga', () => {
    expect(exerciseVolume(prev.exercises[0])).toBe(1200);
    expect(exerciseTopLoad(prev.exercises[0])).toBe(60);
    expect(setVolume({ weight: 40, reps: 8, parts: [{ weight: 40, reps: 8 }, { weight: 30, reps: 6 }] })).toBe(500);
  });

  it('variação de volume total e de carga/volume por exercício; novos e que saíram', () => {
    const c = compareSessions(cur, prev);
    expect(c.volumeDelta).toBe(90);
    expect(c.volumePct).toBeCloseTo(5.625);
    const supino = c.exercises.find((e) => e.name === 'Supino');
    expect(supino).toMatchObject({ status: 'both', load: 65, prevLoad: 60, loadDelta: 5, volume: 1235, prevVolume: 1200, volumeDelta: 35 });
    expect(c.exercises.find((e) => e.name === 'Remada').status).toBe('new');
    expect(c.exercises.find((e) => e.name === 'Crucifixo').status).toBe('removed');
    expect(compareSessions(cur, null)).toBeNull();
  });
});
