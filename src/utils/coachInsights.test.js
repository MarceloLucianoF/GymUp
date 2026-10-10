import { adherenceGrid, adherencePct, adherenceByStudent, recentRecords, buildActionQueue } from './coachInsights';

const NOW = new Date(2024, 5, 20, 12, 0, 0);
const ago = (days) => new Date(2024, 5, 20 - days, 9, 0, 0).toISOString();
const ci = (userId, days, exercises) => ({ userId, date: ago(days), exercises });

describe('adherenceGrid / adherencePct', () => {
  it('monta 4 semanas de 7 dias terminando hoje', () => {
    const grid = adherenceGrid([ci('u', 0), ci('u', 0), ci('u', 27), ci('u', 28)], NOW);
    expect(grid).toHaveLength(4);
    grid.forEach((w) => expect(w).toHaveLength(7));
    expect(grid[3][6].count).toBe(2);
    expect(grid[0][0].count).toBe(1);
    expect(grid.flat().reduce((a, c) => a + c.count, 0)).toBe(3); // dia 28 fica fora
  });
  it('calcula aderência limitada à meta semanal', () => {
    const days = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => ci('u', d));
    const grid = adherenceGrid(days, NOW);
    // semana final: 7 dias (limita a 3), semana anterior: 3 dias -> (3+3)/(3*4)
    expect(adherencePct(grid, 3)).toBe(50);
    expect(adherencePct(adherenceGrid([], NOW), 3)).toBe(0);
  });
  it('agrupa por aluno', () => {
    const res = adherenceByStudent([{ uid: 'a', weeklyGoal: 2 }, { uid: 'b' }], [ci('a', 1), ci('a', 2)], NOW);
    expect(res.a.days).toBe(2);
    expect(res.a.pct).toBe(25);
    expect(res.b.days).toBe(0);
  });
});

describe('recentRecords', () => {
  const ex = (w) => [{ name: 'Supino', sets: [{ weight: w - 5 }, { weight: w }] }];
  it('detecta recorde recente superando marca anterior', () => {
    const r = recentRecords([ci('u', 20, ex(60)), ci('u', 10, ex(70)), ci('u', 2, ex(80))], NOW);
    expect(r.u).toMatchObject({ exercise: 'Supino', weight: 80, previous: 70 });
  });
  it('ignora recorde antigo, primeira marca e igualdade', () => {
    expect(recentRecords([ci('u', 20, ex(60)), ci('u', 15, ex(80))], NOW).u).toBeUndefined();
    expect(recentRecords([ci('u', 1, ex(80))], NOW).u).toBeUndefined();
    expect(recentRecords([ci('u', 10, ex(80)), ci('u', 1, ex(80))], NOW).u).toBeUndefined();
  });
});

describe('buildActionQueue', () => {
  const students = [
    { uid: 'a', displayName: 'A', currentTrainingId: 't', paymentStatus: 'overdue', monthlyFee: 100 },
    { uid: 'b', displayName: 'B', currentTrainingId: 't' },
    { uid: 'c', displayName: 'C', createdAt: new Date(2024, 5, 18).toISOString() },
    { uid: 'd', displayName: 'D', currentTrainingId: 't' },
    { uid: 'e', displayName: 'E', currentTrainingId: 't' }
  ];
  const lastWorkouts = { a: new Date(2024, 5, 19), b: new Date(2024, 5, 10), d: new Date(2024, 5, 19), e: new Date(2024, 5, 19) };
  const checkIns = [ci('d', 10, [{ name: 'Agachamento', sets: [{ weight: 100 }] }]), ci('d', 1, [{ name: 'Agachamento', sets: [{ weight: 110 }] }])];

  it('lista e ordena por prioridade', () => {
    const q = buildActionQueue({ students, lastWorkouts, checkIns, now: NOW });
    expect(q.map((i) => i.type)).toEqual(['overdue', 'inactive', 'nofile', 'record']);
    expect(q[0].student.uid).toBe('a');
    expect(q[1].detail).toBe('10 dias sem treinar');
    expect(q[2]).toMatchObject({ isNew: true, detail: 'Aluno novo sem ficha' });
    expect(q[3].detail).toBe('Recorde em Agachamento: 110 kg');
  });
  it('não sinaliza quem está em dia', () => {
    const q = buildActionQueue({ students, lastWorkouts, checkIns, now: NOW });
    expect(q.find((i) => i.student.uid === 'e')).toBeUndefined();
  });
  it('aluno com ficha que nunca treinou aparece como inativo', () => {
    const q = buildActionQueue({ students: [{ uid: 'z', currentTrainingId: 't' }], now: NOW });
    expect(q[0]).toMatchObject({ type: 'inactive', detail: 'Ainda não treinou' });
  });
});
