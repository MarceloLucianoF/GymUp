import { computeAchievements, countableWorkouts, isCountable, levelOf, workSetsOf } from './achievements';

// Check-in válido: 30 min e 3 séries de trabalho, na data local (meio-dia por padrão).
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();
const ci = (date, extra = {}) => ({ date, createdAt: date, duration: 1800, setsCompleted: 3, exercises: [{ name: 'Supino', sets: [{ weight: 40, reps: 10 }, { weight: 40, reps: 10 }, { weight: 40, reps: 10 }] }], ...extra });
const days = (n, from = new Date(2026, 0, 5)) => Array.from({ length: n }, (_, i) => ci(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 12).toISOString()));
const byId = (res, id) => res.achievements.find((a) => a.id === id);
const heavy = (date, w, extra = {}) => ci(date, { exercises: [{ name: 'Supino', sets: [{ weight: w, reps: 5 }] }], ...extra });

describe('anti-abuso', () => {
  test('menos de 10 min ou menos de 3 séries de trabalho não conta', () => {
    expect(isCountable(ci(at(2026, 1, 5), { duration: 599 }))).toBe(false);
    expect(isCountable(ci(at(2026, 1, 5), { duration: 600 }))).toBe(true);
    expect(isCountable(ci(at(2026, 1, 5), { setsCompleted: 2 }))).toBe(false);
  });

  test('aquecimento não é série de trabalho (sem setsCompleted, conta pelas séries)', () => {
    const sets = [{ weight: 20, reps: 10, type: 'warmup' }, { weight: 40, reps: 10 }, { weight: 40, reps: 10 }];
    expect(workSetsOf({ exercises: [{ name: 'A', sets }] })).toBe(2);
    expect(isCountable({ date: at(2026, 1, 5), duration: 1200, exercises: [{ name: 'A', sets }] })).toBe(false);
  });

  test('check-in antigo sem duração conta se tiver as séries; data inválida ou retroativa > 24 h não conta', () => {
    expect(isCountable(ci(at(2026, 1, 5), { duration: undefined }))).toBe(true);
    expect(isCountable(ci('nada'))).toBe(false);
    expect(isCountable(ci(at(2026, 1, 1), { createdAt: at(2026, 1, 3) }))).toBe(false);
  });

  test('no máximo 1 treino por dia', () => {
    expect(countableWorkouts([ci(at(2026, 1, 5, 8)), ci(at(2026, 1, 5, 19)), ci(at(2026, 1, 6))])).toHaveLength(2);
    expect(computeAchievements([ci(at(2026, 1, 5, 8)), ci(at(2026, 1, 5, 9))]).count).toBe(1);
  });

  test('entrada vazia ou nula não quebra', () => {
    expect(computeAchievements(null).count).toBe(0);
    expect(countableWorkouts(undefined)).toEqual([]);
  });
});

describe('nível', () => {
  test('faixas e barra até o próximo', () => {
    expect(levelOf(0)).toMatchObject({ name: 'Iniciante', next: 'Regular', nextAt: 10, remaining: 10, progress: 0 });
    expect(levelOf(9)).toMatchObject({ name: 'Iniciante', remaining: 1 });
    expect(levelOf(10)).toMatchObject({ name: 'Regular', next: 'Dedicado', progress: 0 });
    expect(levelOf(30).progress).toBe(50);
    expect(levelOf(50).name).toBe('Dedicado');
    expect(levelOf(99)).toMatchObject({ name: 'Dedicado', remaining: 1 });
    expect(levelOf(100)).toMatchObject({ name: 'Atleta', next: null, remaining: 0, progress: 100 });
    expect(levelOf(-3).name).toBe('Iniciante');
  });
});

describe('conquistas', () => {
  test('sem treinos: tudo bloqueado com o que falta', () => {
    const res = computeAchievements([]);
    expect(res.count).toBe(0);
    expect(res.achievements.every((a) => !a.unlocked && a.missing)).toBe(true);
    expect(byId(res, 't10').missing).toBe('Faltam 10 treinos.');
  });

  test('primeiro treino e 10 treinos com a data em que foram obtidos', () => {
    const res = computeAchievements(days(10));
    expect(byId(res, 'first')).toMatchObject({ unlocked: true, missing: '' });
    expect(byId(res, 'first').date.getDate()).toBe(5);
    expect(byId(res, 't10').unlocked).toBe(true);
    expect(byId(res, 't10').date.getDate()).toBe(14);
    expect(byId(res, 't50')).toMatchObject({ unlocked: false, current: 10, missing: 'Faltam 40 treinos.' });
    expect(res.level.name).toBe('Regular');
  });

  test('treino que não conta não soma para 10 treinos', () => {
    const res = computeAchievements([...days(9), ci(at(2026, 3, 1), { duration: 120 })]);
    expect(byId(res, 't10')).toMatchObject({ unlocked: false, missing: 'Falta 1 treino.' });
  });

  test('7 dias seguidos: 6 não basta, 7 basta; um dia vazio quebra a sequência', () => {
    expect(byId(computeAchievements(days(6)), 'streak7').unlocked).toBe(false);
    const seven = computeAchievements(days(7));
    expect(byId(seven, 'streak7').unlocked).toBe(true);
    expect(byId(seven, 'streak7').date.getDate()).toBe(11);
    const broken = [...days(3), ...days(4, new Date(2026, 0, 9))];
    expect(byId(computeAchievements(broken), 'streak7')).toMatchObject({ unlocked: false, current: 4 });
  });

  test('4 semanas seguidas na meta semanal', () => {
    // meta 2: segunda e quarta de semanas seguidas a partir de 05/01/2026 (segunda-feira)
    const weeks = (n, skip = -1) => Array.from({ length: n }, (_, w) => (w === skip ? [] : [ci(at(2026, 1, 5 + w * 7)), ci(at(2026, 1, 7 + w * 7))])).flat();
    const ok = computeAchievements(weeks(4), { weeklyGoal: 2 });
    expect(byId(ok, 'weeks4').unlocked).toBe(true);
    expect(byId(ok, 'weeks4').date.getDate()).toBe(28);   // quarta da 4ª semana
    expect(byId(computeAchievements(weeks(5, 2), { weeklyGoal: 2 }), 'weeks4')).toMatchObject({ unlocked: false, current: 2 });
    expect(byId(computeAchievements(weeks(4), { weeklyGoal: 3 }), 'weeks4').unlocked).toBe(false);
  });

  test('primeiro recorde: precisa de marca anterior e de superá-la, em treino que conta', () => {
    expect(byId(computeAchievements([heavy(at(2026, 1, 5), 40)]), 'pr1').unlocked).toBe(false);
    expect(byId(computeAchievements([heavy(at(2026, 1, 5), 40), heavy(at(2026, 1, 6), 40)]), 'pr1').unlocked).toBe(false);
    const pr = computeAchievements([heavy(at(2026, 1, 5), 40), heavy(at(2026, 1, 8), 45)]);
    expect(byId(pr, 'pr1').unlocked).toBe(true);
    expect(byId(pr, 'pr1').date.getDate()).toBe(8);
    expect(byId(computeAchievements([heavy(at(2026, 1, 5), 40), heavy(at(2026, 1, 9), 50, { duration: 300 })]), 'pr1').unlocked).toBe(false);
  });
});
