import {
  estimate1RM, sessionMetrics, buildExerciseHistory, groupExercises, timeSeries, detectRecords,
  hasRecentRecord, computeTrend, weeklyVolumeByMuscle, muscleFrequency, suggestNextLoad, toDate, filterByPeriod,
} from './analytics';

const ci = (date, exercises) => ({ date, exercises });
const ex = (name, sets, muscleGroup = 'Peito') => ({ name, muscleGroup, sets });
const s = (weight, reps, completed = true) => ({ weight, reps, completed });

describe('analytics básicos', () => {
  test('Epley e bordas', () => {
    expect(estimate1RM(100, 10)).toBe(133.3);
    expect(estimate1RM(100, 0)).toBe(0);
    expect(estimate1RM('x', 5)).toBe(0);
    expect(estimate1RM(0, 5)).toBe(0);
  });
  test('sessionMetrics', () => {
    expect(sessionMetrics([])).toBeNull();
    expect(sessionMetrics(undefined)).toBeNull();
    expect(sessionMetrics([s(50, 0)])).toBeNull();
    const m = sessionMetrics([s(50, 10), s(60, 8), s(70, 5, false)]);
    expect(m.volume).toBe(980);
    expect(m.maxWeight).toBe(60);
    expect(m.totalReps).toBe(18);
    expect(m.bestSet).toEqual({ weight: 60, reps: 8 });
  });
  test('toDate', () => {
    expect(toDate('lixo')).toBeNull();
    expect(toDate(null)).toBeNull();
    expect(toDate({ seconds: 10 }).getTime()).toBe(10000);
  });
});

describe('histórico e recordes', () => {
  const data = [
    ci('2026-03-10T10:00:00Z', [ex('Supino', [s(60, 10)])]),
    ci('invalid', [ex('Supino', [s(999, 10)])]),
    ci('2026-03-01T10:00:00Z', [ex('Supino', [s(50, 10)]), ex('Remada', [s(40, 10)], 'Costas')]),
    ci('2026-03-20T10:00:00Z', [ex('Supino', [s(60, 12)])]),
  ];
  test('ordena, ignora datas inválidas e sem dados', () => {
    const h = buildExerciseHistory(data, 'Supino');
    expect(h.map((x) => x.maxWeight)).toEqual([50, 60, 60]);
    expect(buildExerciseHistory([], 'Supino')).toEqual([]);
    expect(buildExerciseHistory(null, 'Supino')).toEqual([]);
    expect(buildExerciseHistory(data, 'Inexistente')).toEqual([]);
    expect(groupExercises(data).map((e) => e.name).sort()).toEqual(['Remada', 'Supino']);
  });
  test('recordes com data e recência', () => {
    const h = buildExerciseHistory(data, 'Supino');
    const r = detectRecords(h);
    expect(r.weight.value).toBe(60);
    expect(r.weight.date).toBe(h[1].date);
    expect(r.e1rm.date).toBe(h[2].date);
    expect(r.events.map((e) => e.index)).toEqual([1, 2]);
    expect(hasRecentRecord(r, 14, new Date('2026-03-25T00:00:00Z'))).toBe(true);
    expect(hasRecentRecord(r, 3, new Date('2026-04-25T00:00:00Z'))).toBe(false);
    expect(detectRecords([]).weight).toBeNull();
  });
  test('timeSeries e período', () => {
    const h = buildExerciseHistory(data, 'Supino');
    expect(timeSeries(h, 'volume')).toHaveLength(3);
    expect(filterByPeriod(h, 30, new Date('2026-03-21T00:00:00Z'))).toHaveLength(3);
    expect(filterByPeriod(h, 5, new Date('2026-03-21T00:00:00Z'))).toHaveLength(1);
    expect(filterByPeriod(h, null)).toHaveLength(3);
  });
});

describe('tendência', () => {
  const mk = (weights) => weights.map((w, i) => ({ ts: Date.UTC(2026, 0, 1 + i * 7), date: new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString(), e1rm: w }));
  test('subindo, caindo, estável, poucos dados', () => {
    expect(computeTrend(mk([100, 105, 110, 115])).direction).toBe('subindo');
    expect(computeTrend(mk([115, 110, 105, 100])).direction).toBe('caindo');
    expect(computeTrend(mk([100, 100, 100, 100])).direction).toBe('estavel');
    expect(computeTrend(mk([100, 110])).enough).toBe(false);
    expect(computeTrend([]).direction).toBe('estavel');
  });
  test('% por mês plausível', () => {
    const t = computeTrend(mk([100, 105, 110, 115]));
    expect(t.percentPerMonth).toBeGreaterThan(15);
    expect(t.percentPerMonth).toBeLessThan(25);
  });
});

describe('grupos musculares', () => {
  const now = new Date(2026, 2, 18, 12); // quarta
  const data = [
    ci(new Date(2026, 2, 16, 9).toISOString(), [ex('A', [s(10, 10)], 'Peito'), ex('B', [s(20, 5)], 'Costas')]),
    ci(new Date(2026, 2, 17, 9).toISOString(), [ex('A', [s(10, 10)], 'Peito')]),
    ci(new Date(2026, 0, 1).toISOString(), [ex('A', [s(10, 10)], 'Peito')]),
    ci('x', [ex('A', [s(10, 10)], 'Peito')]),
  ];
  test('volume semanal', () => {
    const w = weeklyVolumeByMuscle(data, 4, now);
    expect(w).toHaveLength(4);
    expect(w[3].groups.Peito).toBe(200);
    expect(w[3].total).toBe(300);
    expect(weeklyVolumeByMuscle([], 2, now).every((b) => b.total === 0)).toBe(true);
  });
  test('frequência 30d', () => {
    const f = muscleFrequency(data, 30, now);
    expect(f[0]).toEqual({ group: 'Peito', sessions: 2, volume: 200 });
    expect(f[1].group).toBe('Costas');
    expect(muscleFrequency(null, 30, now)).toEqual([]);
  });
});

describe('próxima carga', () => {
  test('aumenta quando bate o topo', () => {
    const sug = suggestNextLoad(sessionMetrics([s(80, 12), s(80, 12), s(80, 12)]));
    expect(sug.action).toBe('aumentar');
    expect(sug.weight).toBe(82);
  });
  test('mantém quando falta rep', () => {
    expect(suggestNextLoad(sessionMetrics([s(80, 12), s(80, 10)])).action).toBe('manter');
  });
  test('sem dados / sem carga / carga pequena', () => {
    expect(suggestNextLoad(null)).toBeNull();
    expect(suggestNextLoad(sessionMetrics([s(0, 12)]))).toBeNull();
    expect(suggestNextLoad(sessionMetrics([s(5, 12)])).weight).toBe(5.5);
  });
});
