import {
  hydrateExercises, buildLoadMap, getLastReps, getSmartTip, summarizeSession, detectNewPRs, buildExerciseLoadLogs,
  adjustValue, getLastSessionSets, getLastNote, buildCopyFromLast, isPRSet, normalizeRpe, buildShareText, formatDuration,
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

describe('utilidades de execução', () => {
  const hist = [
    { exercises: [{ name: 'Supino', note: ' banco no 4 ', sets: [{ weight: 60, reps: 10 }, { weight: 70, reps: 8 }] }] },
    { exercises: [{ name: 'Supino', sets: [{ weight: 50, reps: 12 }] }] },
  ];

  it('adjustValue soma, parte da base e não fica negativo', () => {
    expect(adjustValue('60', 2.5)).toBe('62.5');
    expect(adjustValue('', 2.5, 40)).toBe('42.5');
    expect(adjustValue('1', -2.5)).toBe('');
    expect(adjustValue('10,5', 1)).toBe('11.5');
  });
  it('lê a última sessão e a nota', () => {
    expect(getLastSessionSets(hist, 'Supino')).toEqual([{ weight: 60, reps: 10 }, { weight: 70, reps: 8 }]);
    expect(getLastSessionSets(hist, 'Remada')).toEqual([]);
    expect(getLastNote(hist, 'Supino')).toBe('banco no 4');
    expect(getLastNote([], 'X')).toBe('');
  });
  it('buildCopyFromLast repete a última série e ignora vazio', () => {
    expect(buildCopyFromLast([{ weight: 60, reps: 10 }, { weight: 70, reps: 8 }], 3)).toEqual([
      { weight: '60', reps: '10' }, { weight: '70', reps: '8' }, { weight: '70', reps: '8' },
    ]);
    expect(buildCopyFromLast([], 3)).toEqual([]);
  });
  it('isPRSet exige histórico prévio', () => {
    expect(isPRSet('72', 70)).toBe(true);
    expect(isPRSet('70', 70)).toBe(false);
    expect(isPRSet('80', 0)).toBe(false);
  });
  it('normalizeRpe valida 1-10', () => {
    expect(normalizeRpe(8)).toBe(8);
    expect(normalizeRpe(0)).toBeNull();
    expect(normalizeRpe(11)).toBeNull();
    expect(normalizeRpe('x')).toBeNull();
  });
  it('summarizeSession inclui rpe e nota opcionais', () => {
    const exs = [{ name: 'Supino', muscleGroup: 'Peito', sets: '2' }];
    const sd = { '0-0': { completed: true, weight: '60', reps: '10', rpe: 8 }, '0-1': { completed: true, weight: '60', reps: '10' }, 'note-0': { note: 'banco no 4' } };
    const { executedExercises } = summarizeSession(exs, sd);
    expect(executedExercises[0].note).toBe('banco no 4');
    expect(executedExercises[0].sets[0].rpe).toBe(8);
    expect(executedExercises[0].sets[1].rpe).toBeUndefined();
  });
  it('formata texto de compartilhamento e duração', () => {
    const t = buildShareText({ trainingName: 'Treino A', timeStr: '45m 00s', volumeKg: 5000.4, completedSetsCount: 12, newPRs: ['Supino'] });
    expect(t).toContain('Treino A');
    expect(t).toContain('5000 kg');
    expect(t).toContain('Recordes: Supino');
    expect(buildShareText({ timeStr: '1m', volumeKg: 0, completedSetsCount: 0 })).not.toContain('Recordes');
    expect(formatDuration(125)).toBe('2m 05s');
  });
});
