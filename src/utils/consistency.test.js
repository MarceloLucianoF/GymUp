import { afterCheckIn, afterRemoval, consistency, dayKey, rankRows, weekKey } from './consistency';

// Datas ao meio-dia local para não depender do fuso.
const at = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();

describe('semana e dia', () => {
  it('semana ISO começa na segunda', () => {
    expect(weekKey(at(2026, 10, 12))).toBe(weekKey(at(2026, 10, 18))); // segunda a domingo
    expect(weekKey(at(2026, 10, 18))).not.toBe(weekKey(at(2026, 10, 19)));
    expect(weekKey(at(2026, 1, 1))).toBe('2026-W01');
    expect(weekKey('lixo')).toBe('');
    expect(dayKey(at(2026, 3, 5))).toBe('2026-03-05');
  });
});

describe('afterCheckIn', () => {
  it('primeiro treino abre semana e sequência', () => {
    const r = afterCheckIn(null, at(2026, 10, 12));
    expect(r).toMatchObject({ weekCount: 1, weekDays: ['2026-10-12'], streak: 1, lastActiveDay: '2026-10-12' });
  });
  it('mesma semana soma; mesmo dia não aumenta a sequência; dia seguinte aumenta', () => {
    let s = afterCheckIn(null, at(2026, 10, 12));
    s = afterCheckIn(s, at(2026, 10, 12));
    expect(s).toMatchObject({ weekCount: 2, weekDays: ['2026-10-12'], streak: 1 });
    s = afterCheckIn(s, at(2026, 10, 13));
    expect(s).toMatchObject({ weekCount: 3, weekDays: ['2026-10-12', '2026-10-13'], streak: 2 });
  });
  it('pular um dia reinicia a sequência; semana nova reinicia a contagem', () => {
    let s = afterCheckIn(null, at(2026, 10, 12));
    s = afterCheckIn(s, at(2026, 10, 15));
    expect(s).toMatchObject({ weekCount: 2, streak: 1 });
    s = afterCheckIn(s, at(2026, 10, 19));
    expect(s).toMatchObject({ weekCount: 1, weekDays: ['2026-10-19'] });
  });
  it('check-in atrasado de semana anterior não mexe na semana atual nem na sequência', () => {
    const s = afterCheckIn(afterCheckIn(null, at(2026, 10, 19)), at(2026, 10, 14));
    expect(s).toMatchObject({ weekCount: 1, weekDays: ['2026-10-19'], streak: 1, lastActiveDay: '2026-10-19' });
  });
  it('documentos antigos sem campos semanais começam do zero', () => {
    expect(afterCheckIn({ checkInCount: 10 }, at(2026, 10, 12))).toMatchObject({ weekCount: 1, streak: 1 });
  });
});

describe('afterRemoval e consistency', () => {
  it('apagar treino da semana corrente baixa a contagem (nunca abaixo de zero)', () => {
    const s = afterCheckIn(afterCheckIn(null, at(2026, 10, 12)), at(2026, 10, 13));
    expect(afterRemoval(s, at(2026, 10, 13)).weekCount).toBe(1);
    expect(afterRemoval(s, at(2026, 9, 1)).weekCount).toBe(2);
    expect(afterRemoval({ weekKey: s.weekKey, weekCount: 0 }, at(2026, 10, 12)).weekCount).toBe(0);
  });
  it('mostra zero para outra semana e esconde sequência vencida', () => {
    const s = afterCheckIn(afterCheckIn(null, at(2026, 10, 12)), at(2026, 10, 13));
    expect(consistency(s, new Date(2026, 9, 14, 10))).toEqual({ workouts: 2, activeDays: 2, streak: 2 });
    expect(consistency(s, new Date(2026, 9, 20, 10))).toEqual({ workouts: 0, activeDays: 0, streak: 0 });
    expect(consistency(null)).toEqual({ workouts: 0, activeDays: 0, streak: 0 });
  });
});

describe('rankRows', () => {
  it('ordena por treinos, dias e sequência, com empate na mesma posição', () => {
    const rows = rankRows([
      { name: 'Ana', workouts: 2, activeDays: 2, streak: 1 },
      { name: 'João', workouts: 4, activeDays: 3, streak: 2 },
      { name: 'Bia', workouts: 2, activeDays: 2, streak: 1 },
      { name: 'Marcelo', workouts: 3, activeDays: 3, streak: 3 }
    ]);
    expect(rows.map((r) => `${r.position}.${r.name}`)).toEqual(['1.João', '2.Marcelo', '3.Ana', '3.Bia']);
  });
});
