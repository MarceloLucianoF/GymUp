import { applyTechnique, hasSetPlan, normalizePlanItem, normalizeSetPlan, partsText, planItemType, planLabel, planReps, setPlanSummary, setVolume, techniqueOf } from './setTypes';
import { buildSetParts, detectNewPRs, hydrateExercises, summarizeSession } from './training';
import { sessionMetrics } from './analytics';
import { toWorkoutExercise } from '../services/workoutImport';
import { workoutShareText } from './workoutShare';

describe('rótulos do plano por série', () => {
  test('isometria antes/depois, drop com cargas, falha, drop + falha e cluster', () => {
    expect(planLabel({ reps: '15', isoBeforeSec: 10 })).toBe("10'' iso + 15");
    expect(planLabel({ reps: '15', isoAfterSec: 5 })).toBe("15 + 5'' iso");
    expect(planLabel({ reps: '6-10', drops: [{ load: 16 }, { load: 12 }] })).toBe('6-10 + drop 16/12');
    expect(planLabel({ drops: [{ load: 12.5 }] }, '8')).toBe('8 + drop 12,5');
    expect(planLabel({ drops: [{}, {}] }, '8')).toBe('8 + drop x2');
    expect(planLabel({ reps: '6-10', failure: true })).toBe('6-10 até a falha');
    expect(planLabel({ reps: '8', drops: [{ load: 20 }], failure: true })).toBe('8 + drop 20 até a falha');
    expect(planLabel({ blocks: [4, 4, 4], blockRestSec: 10 })).toBe('4-4-4 (10 s)');
    expect(planLabel({}, '12')).toBe('12');
  });

  test('resumo do plano inteiro e reps por série; sem plano, vazio', () => {
    const ex = { sets: '3', reps: '12', setTypes: ['warmup', 'normal', 'cluster'], setPlan: [{ reps: '15' }, { isoBeforeSec: 10 }, { blocks: [4, 4, 4], blockRestSec: 10 }] };
    expect(setPlanSummary(ex)).toBe("S1 Aquec. 15 · S2 10'' iso + 12 · S3 4-4-4 (10 s)");
    expect(planReps(ex, 0)).toBe('15');
    expect(planReps(ex, 1)).toBe('12');
    expect(setPlanSummary({ sets: '3', reps: '10' })).toBe('');
    expect(setPlanSummary({ sets: '3', reps: '10', setPlan: [{}, {}, {}] })).toBe('');
  });
});

describe('limpeza e limites', () => {
  test('números inválidos somem, listas ficam no limite (4 drops, 6 blocos, 12 séries)', () => {
    expect(normalizePlanItem({ reps: 'dez', isoBeforeSec: '-3', isoAfterSec: '999', drops: Array(6).fill({ load: '12,5' }), failure: 'sim' }))
      .toEqual({ isoAfterSec: 120, drops: Array(4).fill({ load: 12.5 }) });
    expect(normalizePlanItem({ blocks: ['4', '4', '4', '4', '4', '4', '4', '4'], blockRestSec: '' })).toEqual({ blocks: [4, 4, 4, 4, 4, 4], blockRestSec: 10 });
    expect(normalizePlanItem({ blocks: [5] })).toBeNull();                                   // cluster precisa de 2+ blocos
    expect(normalizePlanItem({ drops: [{}], blocks: [3, 3] })).toEqual({ drops: [{}] });     // drop e cluster juntos: fica o drop
    expect(normalizePlanItem(null)).toBeNull();
    expect(normalizeSetPlan([{ reps: '15' }], 20)).toHaveLength(12);
    expect(normalizeSetPlan([{ reps: '15' }, { reps: '8' }, { reps: '6' }], 2)).toEqual([{ reps: '15' }, { reps: '8' }]);
    expect(normalizeSetPlan([{}, { reps: '' }], 3)).toBeNull();
    expect(normalizeSetPlan(undefined, 3)).toBeNull();
    expect(hasSetPlan([{}, { isoAfterSec: 5 }])).toBe(true);
    expect(planItemType({ blocks: [4, 4] })).toBe('cluster');
    expect(planItemType({ drops: [{}] })).toBe('drop');
    expect(planItemType({ reps: '8' })).toBeNull();
  });

  test('técnica do menu <-> tipo e campos, mantendo as reps próprias', () => {
    expect(applyTechnique('isoBefore', { reps: '15' })).toEqual({ type: 'normal', item: { reps: '15', isoBeforeSec: 10 } });
    expect(applyTechnique('dropFailure', { reps: '8', drops: [{ load: 16 }] })).toEqual({ type: 'drop', item: { reps: '8', drops: [{ load: 16 }], failure: true } });
    expect(applyTechnique('cluster', { reps: '12' })).toEqual({ type: 'cluster', item: { blocks: [4, 4, 4], blockRestSec: 10 } });
    expect(applyTechnique('normal', { reps: '12', isoAfterSec: 5 })).toEqual({ type: 'normal', item: { reps: '12' } });
    expect(techniqueOf('drop', {})).toBe('drop');                       // ficha antiga: drop sem plano
    expect(techniqueOf('drop', { drops: [{}], failure: true })).toBe('dropFailure');
    expect(techniqueOf('normal', { isoAfterSec: 5 })).toBe('isoAfter');
    expect(techniqueOf('warmup', undefined)).toBe('warmup');
  });
});

describe('execução: partes, volume, recorde e isometria', () => {
  const exercises = [
    { name: 'Rosca', muscleGroup: 'biceps', sets: '3', reps: '6-10', setTypes: ['normal', 'drop', 'cluster'],
      setPlan: [{ reps: '15', isoBeforeSec: 10 }, { drops: [{ load: 16 }, { load: 12 }] }, { blocks: [4, 4, 4], blockRestSec: 10 }] }
  ];
  const session = {
    '0-0': { completed: true, weight: '14', reps: '15' },
    '0-1': { completed: true, weight: '20', reps: '8', extra: [{ reps: '6' }, { weight: '10', reps: '5' }] },
    '0-2': { completed: true, weight: '18', reps: '4', extra: [{}, { reps: '3' }] }
  };

  test('drop e cluster gravam parts; volume = soma das partes; isometria grava isoSec', () => {
    const { totalVolume, setsCompleted, executedExercises } = summarizeSession(exercises, session);
    const [s1, s2, s3] = executedExercises[0].sets;
    expect(s1).toEqual({ weight: 14, reps: 15, completed: true, isoSec: 10 });
    expect(s2).toEqual({ weight: 20, reps: 8, completed: true, type: 'drop', parts: [{ weight: 20, reps: 8 }, { weight: 16, reps: 6 }, { weight: 10, reps: 5 }] });
    expect(s3).toEqual({ weight: 18, reps: 4, completed: true, type: 'cluster', parts: [{ weight: 18, reps: 4 }, { weight: 18, reps: 4 }, { weight: 18, reps: 3 }] });
    expect(setsCompleted).toBe(3);
    expect(totalVolume).toBe(14 * 15 + (160 + 96 + 50) + 18 * 11);
    expect(setVolume(s2)).toBe(306);
    expect(sessionMetrics(executedExercises[0].sets).volume).toBe(totalVolume);
    expect(partsText(s2, 'weight')).toBe('20+16+10');
    expect(partsText(s1, 'reps')).toBe(15);
  });

  test('drop sem reps digitadas não inventa parte; drop sem plano (ficha antiga) não tem partes', () => {
    expect(buildSetParts('drop', { drops: [{ load: 16 }] }, {}, 20, 8)).toBeNull();
    expect(buildSetParts('drop', { drops: [{}] }, { extra: [{ reps: '6' }] }, 20, 8)).toEqual([{ weight: 20, reps: 8 }, { weight: 14, reps: 6 }]);   // ~70%
    expect(buildSetParts('drop', {}, { extra: [{ reps: '6' }] }, 20, 8)).toBeNull();
  });

  test('recorde de carga usa só a 1ª parte', () => {
    const s = { '0-1': { completed: true, weight: '20', reps: '8', extra: [{ weight: '30', reps: '2' }] } };
    expect(detectNewPRs(exercises, s, { Rosca: 22 })).toEqual([]);
    expect(detectNewPRs(exercises, { '0-1': { completed: true, weight: '23', reps: '8' } }, { Rosca: 22 })).toEqual(['Rosca']);
  });

  test('ficha sem setPlan: resumo como antes, sem parts nem isoSec', () => {
    const old = [{ name: 'Supino', sets: '2', reps: '10', setTypes: ['normal', 'drop'] }];
    const { totalVolume, executedExercises } = summarizeSession(old, { '0-0': { completed: true, weight: '60', reps: '10' }, '0-1': { completed: true, weight: '42', reps: '8', extra: [{ reps: '5' }] } });
    expect(totalVolume).toBe(600 + 336);
    expect(executedExercises[0].sets).toEqual([{ weight: 60, reps: 10, completed: true }, { weight: 42, reps: 8, completed: true, type: 'drop' }]);
    const [h] = hydrateExercises([{ name: 'Supino', sets: '3', reps: '10' }], []);
    expect(h.setPlan).toBeUndefined();
  });
});

describe('gravação e compartilhamento', () => {
  test('hidratar e salvar limpam o plano; cardio não tem plano', () => {
    const [h] = hydrateExercises([{ name: 'Rosca', sets: '2', reps: '10', setPlan: [{ reps: '15', isoAfterSec: '5' }, { blocks: [4, 'x'] }, { reps: '8' }] }], []);
    expect(h.setPlan).toEqual([{ reps: '15', isoAfterSec: 5 }, { blocks: [4, 1], blockRestSec: 10 }]);
    const saved = toWorkoutExercise({ name: 'Rosca', kind: 'strength', sets: 2, reps: '10', rest: 60, setPlan: [{ drops: [{ load: '16' }] }, {}] }, null, 0);
    expect(saved.setPlan).toEqual([{ drops: [{ load: 16 }] }, {}]);
    expect('setPlan' in toWorkoutExercise({ name: 'Rosca', kind: 'strength', sets: 2, reps: '10', rest: 60 }, null, 0)).toBe(false);
    expect('setPlan' in toWorkoutExercise({ name: 'Esteira', kind: 'cardio', durationMin: 20, setPlan: [{ reps: '5' }] }, null, 0)).toBe(false);
  });

  test('texto de compartilhar mostra a meta de cada série', () => {
    const text = workoutShareText({ name: 'Braço', exercises: [{ name: 'Rosca', sets: '2', reps: '6-10', setTypes: ['normal', 'drop'], setPlan: [{ reps: '15', isoAfterSec: 5 }, { drops: [{ load: 16 }, { load: 12 }] }] }] });
    expect(text).toContain("- Rosca: 2 x 6-10 [S1 15 + 5'' iso · S2 6-10 + drop 16/12]");
  });
});
