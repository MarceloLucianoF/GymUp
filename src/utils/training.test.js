import {
  hydrateExercises, buildLoadMap, getLastReps, getSmartTip, summarizeSession, detectNewPRs, buildExerciseLoadLogs,
} from './training';

describe('hydrateExercises', () => {
  const lib = [{ firestoreId: 'a1', name: 'Supino', muscleGroup: 'Peito', sets: 4, reps: '8', rest: 90 }];

  it('cruza id com a biblioteca', () => {
    const [ex] = hydrateExercises(['a1'], lib);
    expect(ex).toMatchObject({ name: 'Supino', muscleGroup: 'Peito', sets: '4', reps: '8', rest: 90 });
  });

  it('cruza por nome ignorando caixa e preserva overrides', () => {
    const [ex] = hydrateExercises([{ name: 'supino', reps: 12 }], lib);
    expect(ex.reps).toBe('12');
    expect(ex.muscleGroup).toBe('Peito');
  });

  it('aplica defaults para itens nulos e desconhecidos', () => {
    const [nul, unk] = hydrateExercises([null, 'zzz'], lib);
    expect(nul).toMatchObject({ name: 'Exercício 1', sets: '3', reps: '10', rest: 60 });
    expect(unk).toMatchObject({ name: 'Exercício 2', muscleGroup: 'Geral', sets: '3', rest: 60 });
  });
});

const history = [
  { date: new Date(2024, 0, 2), exercises: [{ name: 'Supino', sets: [{ weight: 60, reps: 8 }, { weight: 70, reps: 6 }] }] },
  { date: new Date(2024, 0, 1), exercises: [{ name: 'Supino', sets: [{ weight: 50, reps: 10 }] }, { name: 'Remada', sets: [{ weight: 40, reps: 10 }] }] },
];

describe('histórico de cargas', () => {
  it('buildLoadMap usa a carga máxima mais recente', () => {
    expect(buildLoadMap(history)).toEqual({ Supino: 70, Remada: 40 });
  });
  it('getLastReps devolve reps da série mais pesada do último treino', () => {
    expect(getLastReps(history, 'Supino')).toBe(6);
    expect(getLastReps(history, 'Agachamento')).toBeNull();
  });
  it('buildExerciseLoadLogs lista um registro por treino', () => {
    const logs = buildExerciseLoadLogs(history, 'Supino');
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ maxWeight: 70, setsCount: 2 });
  });
});

describe('getSmartTip', () => {
  it('sugere primeira carga sem histórico', () => {
    expect(getSmartTip(0, null, 10)).toMatch(/primeira carga/);
  });
  it('sugere subir carga quando bateu a meta de reps', () => {
    expect(getSmartTip(50, 10, 10)).toContain('52kg');
  });
  it('sugere mais reps quando abaixo da meta', () => {
    expect(getSmartTip(50, 8, 10)).toContain('9-10 reps com 50kg');
  });
});

describe('summarizeSession', () => {
  const exercises = [{ name: 'Supino', muscleGroup: 'Peito', sets: '3' }, { name: 'Remada', sets: '2' }];
  const session = {
    '0-0': { completed: true, weight: '60', reps: '10' },
    '0-1': { completed: true, weight: '60', reps: '8' },
    '0-2': { completed: false, weight: '60', reps: '8' },
  };

  it('soma volume e séries concluídas', () => {
    const r = summarizeSession(exercises, session);
    expect(r.totalVolume).toBe(60 * 10 + 60 * 8);
    expect(r.setsCompleted).toBe(2);
  });
  it('omite exercícios sem séries concluídas', () => {
    const r = summarizeSession(exercises, session);
    expect(r.executedExercises.map((e) => e.name)).toEqual(['Supino']);
  });
  it('trata entradas vazias', () => {
    expect(summarizeSession(exercises, {})).toEqual({ totalVolume: 0, setsCompleted: 0, executedExercises: [] });
  });
});

describe('detectNewPRs', () => {
  const exercises = [{ name: 'Supino', sets: '2' }, { name: 'Remada', sets: '2' }];
  const session = {
    '0-0': { completed: true, weight: '80' },
    '1-0': { completed: true, weight: '30' },
  };
  it('retorna só exercícios que superaram o recorde anterior', () => {
    expect(detectNewPRs(exercises, session, { Supino: 70, Remada: 40 })).toEqual(['Supino']);
  });
  it('não conta como recorde sem histórico prévio', () => {
    expect(detectNewPRs(exercises, session, {})).toEqual([]);
  });
});
