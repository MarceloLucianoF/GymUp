import { buildWeeklySummary, completedWorkouts, localNarrative, factsHash, aiMessages, narrativeMatchesFacts } from './weeklySummary';

const NOW = new Date(2026, 9, 14, 15, 0);                       // quarta, 14/10/2026 (semana 12/10 a 18/10)
const at = (m, d, h = 10) => new Date(2026, m, d, h, 0).toISOString();
let seq = 0;
const w = (m, d, extra = {}) => ({ id: `w${seq += 1}`, trainingId: 't1', date: at(m, d), duration: 3000, totalVolume: 1000, setsCompleted: 10, exercises: [{ name: 'Supino', sets: [{ weight: 50, completed: true }] }], ...extra });

describe('resumo semanal determinístico', () => {
  it('semana de segunda a domingo no fuso do aparelho; domingo à noite ainda é da semana certa', () => {
    const history = [w(9, 18, { date: new Date(2026, 9, 18, 23, 30).toISOString() }), w(9, 12), w(9, 11, { date: new Date(2026, 9, 11, 23, 59).toISOString() })];
    const last = buildWeeklySummary({ history, weeklyGoal: 4, now: new Date(2026, 9, 19, 9, 0), which: 'last' });
    expect(last).toMatchObject({ start: '2026-10-12', end: '2026-10-18', workouts: 2, closed: true });   // domingo 23:30 e segunda contam; o de domingo 11 não
    const prev = buildWeeklySummary({ history, weeklyGoal: 4, now: new Date(2026, 9, 19, 9, 0), which: 'current' });
    expect(prev.start).toBe('2026-10-19');
    expect(prev.workouts).toBe(0);
  });

  it('virada de mês: a semana 28/09 a 04/10 junta setembro e outubro num só resumo', () => {
    const now = new Date(2026, 9, 5, 9, 0);                      // segunda 05/10
    const history = [w(8, 30), w(9, 2), w(9, 4)];
    const s = buildWeeklySummary({ history, weeklyGoal: 3, now, which: 'last' });
    expect(s).toMatchObject({ start: '2026-09-28', end: '2026-10-04', workouts: 3, activeDays: 3 });
    expect(s.goal).toEqual({ weekly: 3, remaining: 0, met: true });
  });

  it('não duplica: mesmo id, mesmo clientId (reenvio offline) e série concluída zero não contam', () => {
    const base = w(9, 13, { id: 'x', clientId: 'c1' });
    const history = [base, { ...base }, { ...base, id: 'y' }, w(9, 13, { id: 'p', setsCompleted: 0 }), w(9, 14, { id: 'z' })];
    expect(completedWorkouts(history)).toHaveLength(2);
    expect(buildWeeklySummary({ history, now: NOW }).workouts).toBe(2);
  });

  it('soma minutos, volume e séries; dias distintos; exercícios mais feitos em ordem; ignora datas futuras e inválidas', () => {
    const history = [
      w(9, 12, { duration: 1800, totalVolume: 500, exercises: [{ name: 'Supino' }, { name: 'Remada' }] }),
      w(9, 12, { duration: 1800, totalVolume: 700, exercises: [{ name: 'Supino' }] }),
      w(9, 13, { duration: 1200, totalVolume: 800, exercises: [{ name: 'Agachamento' }, { name: 'Supino' }] }),
      w(9, 20), { date: 'x' }, null
    ];
    const s = buildWeeklySummary({ history, now: NOW });
    expect(s).toMatchObject({ workouts: 3, activeDays: 2, minutes: 80, volume: 2000, sets: 30 });
    expect(s.topExercises).toEqual([{ name: 'Supino', sessions: 3 }, { name: 'Agachamento', sessions: 1 }, { name: 'Remada', sessions: 1 }]);
    expect(s.texts.volume).toBe('2,0 t');
    expect(s.tz).toBeTruthy();
  });

  it('meta e sequência: faltam N; sequência vale se treinou hoje ou ontem', () => {
    const history = [w(9, 14), w(9, 13), w(9, 12)];
    const s = buildWeeklySummary({ history, weeklyGoal: 4, now: NOW });
    expect(s.goal).toEqual({ weekly: 4, remaining: 1, met: false });
    expect(s.streak).toBe(3);
    expect(buildWeeklySummary({ history: [w(9, 12)], weeklyGoal: 4, now: NOW }).streak).toBe(0);   // última vez há 2 dias
    expect(buildWeeklySummary({ history: [w(9, 13)], weeklyGoal: 4, now: NOW }).streak).toBe(1);   // ontem ainda vale
  });

  it('comparação com a semana anterior só em semana completa; em andamento não compara', () => {
    const history = [w(9, 5, { totalVolume: 1000 }), w(9, 13, { totalVolume: 1080 })];
    const now = new Date(2026, 9, 19, 9, 0);
    const closed = buildWeeklySummary({ history, now, which: 'last' });
    expect(closed.comparison).toEqual({ previousWorkouts: 1, previousVolume: 1000, volumePct: 8 });
    expect(buildWeeklySummary({ history, now: NOW }).comparison).toBeNull();
  });

  it('recordes da semana: só os que passaram de uma marca anterior dentro da semana', () => {
    const history = [w(9, 5, { exercises: [{ name: 'Supino', sets: [{ weight: 60, completed: true }] }] }), w(9, 13, { exercises: [{ name: 'Supino', sets: [{ weight: 70, completed: true }] }] })];
    const s = buildWeeklySummary({ history, now: NOW });
    expect(s.records).toEqual([{ exercise: 'Supino', weight: 70, previous: 60 }]);
  });

  it('sem treinos: estado vazio útil, com a meta', () => {
    const s = buildWeeklySummary({ history: [], weeklyGoal: 3, now: NOW });
    expect(s.workouts).toBe(0);
    expect(localNarrative(s)).toBe('Nenhum treino concluído nesta semana ainda. Sua meta é 3 treinos por semana: que tal começar hoje?');
    expect(localNarrative(buildWeeklySummary({ history: [], weeklyGoal: 3, now: NOW, which: 'last' }))).toContain('semana passada');
  });
});

describe('texto, identidade dos números e IA', () => {
  const f = buildWeeklySummary({ history: [w(9, 12), w(9, 13), w(9, 14)], weeklyGoal: 4, now: NOW });

  it('texto local usa só os números da tela', () => {
    expect(localNarrative(f)).toBe('Você concluiu 3 de 4 treinos nesta semana, em 3 dias, somando 150 minutos e 3,0 t. Falta 1 treino para a meta. Sequência atual: 3 dias. Novo recorde: Supino (50 kg).'.replace(' Novo recorde: Supino (50 kg).', ''));
  });

  it('hash muda quando os números mudam e não muda com a mesma semana repetida', () => {
    expect(factsHash(f)).toBe(factsHash(buildWeeklySummary({ history: [w(9, 12), w(9, 13), w(9, 14)], weeklyGoal: 4, now: NOW })));
    expect(factsHash(f)).not.toBe(factsHash(buildWeeklySummary({ history: [w(9, 12), w(9, 13)], weeklyGoal: 4, now: NOW })));
    expect(factsHash(f)).not.toBe(factsHash(buildWeeklySummary({ history: [w(9, 12), w(9, 13), w(9, 14)], weeklyGoal: 5, now: NOW })));
  });

  it('o que vai para a IA: só números e exercícios; nada de nome, e-mail, peso corporal, medidas ou IDs', () => {
    const [sys, user] = aiMessages(f);
    expect(sys.content).toMatch(/SOMENTE os números/);
    const payload = JSON.parse(user.content);
    expect(Object.keys(payload).sort()).toEqual(['dias_com_treino', 'exercicios_mais_feitos', 'faltam_para_meta', 'intervalo', 'meta_cumprida', 'meta_semanal', 'minutos', 'periodo', 'recordes', 'sequencia_dias', 'treinos_concluidos', 'variacao_volume_vs_semana_anterior_pct', 'volume']);
    expect(JSON.stringify(payload)).not.toContain('@');
    const withPii = buildWeeklySummary({ history: [w(9, 12, { userEmail: 'a@b.com', userId: 'U1', userPhoto: 'x', weight: 80, trainingName: 'Segredo' })], weeklyGoal: 4, now: NOW });
    const sent = JSON.stringify(aiMessages(withPii));
    ['a@b.com', 'U1', 'Segredo', '"weight"'].forEach((x) => expect(sent).not.toContain(x));
    expect(JSON.parse(user.content)).toMatchObject({ treinos_concluidos: 3, meta_semanal: 4, minutos: 150, volume: '3,0 t' });
  });

  it('resposta da IA só vale se todo número existe nos fatos', () => {
    expect(narrativeMatchesFacts('Você completou 3 de 4 treinos nesta semana, somando 150 minutos e 3,0 t. Falta 1 treino.', f)).toBe(true);
    expect(narrativeMatchesFacts('Você completou 4 de 4 treinos e treinou 200 minutos.', f)).toBe(false);   // números inventados
    expect(narrativeMatchesFacts('curto', f)).toBe(false);
    expect(narrativeMatchesFacts('', f)).toBe(false);
    expect(narrativeMatchesFacts('x'.repeat(800), f)).toBe(false);
  });
});
