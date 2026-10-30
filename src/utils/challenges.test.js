import {
  activeDaysIn, addDays, challengeState, checkInDay, dayOfChallenge, daysBetween, endDayOf, nextScore, normalizeChallengeCode, rankMembers, validateChallengeInput
} from './challenges';

const ch = (over = {}) => ({ startDay: '2026-10-26', endDay: '2026-11-01', durationDays: 7, status: 'active', ...over });
const at = (day, hour = 12) => ({ date: new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString() });

describe('datas', () => {
  test('soma dias e conta a distância sem depender do fuso', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-26', '2026-11-01')).toBe(6);
    expect(endDayOf('2026-10-26', 7)).toBe('2026-11-01');
    expect(endDayOf('2026-10-26', 30)).toBe('2026-11-24');
  });
  test('dia do check-in aceita texto, Date e Timestamp', () => {
    const d = new Date(2026, 9, 27, 22, 30);
    expect(checkInDay({ date: d.toISOString() })).toBe('2026-10-27');
    expect(checkInDay({ date: { toDate: () => d } })).toBe('2026-10-27');
    expect(checkInDay({})).toBe('');
  });
  test('estado e dia do desafio', () => {
    expect(challengeState(ch(), '2026-10-25')).toBe('upcoming');
    expect(challengeState(ch(), '2026-10-28')).toBe('active');
    expect(challengeState(ch(), '2026-11-02')).toBe('finished');
    expect(challengeState(ch({ status: 'ended' }), '2026-10-28')).toBe('ended');
    expect(dayOfChallenge(ch(), '2026-10-28')).toBe(3);
    expect(dayOfChallenge(ch(), '2026-12-01')).toBe(7);
  });
});

describe('dias ativos', () => {
  test('conta no máximo 1 por dia, só dentro do período e até hoje', () => {
    const list = [at('2026-10-25'), at('2026-10-26', 8), at('2026-10-26', 19), at('2026-10-28'), at('2026-10-30'), at('2026-11-02')];
    expect(activeDaysIn(list, ch(), '2026-10-29')).toEqual(['2026-10-26', '2026-10-28']);
    expect(activeDaysIn(list, ch(), '2026-11-05')).toEqual(['2026-10-26', '2026-10-28', '2026-10-30']);
  });

  test('primeiro placar e recuperação de vários dias de uma vez', () => {
    const member = { activeDays: 0, lastDay: '' };
    expect(nextScore(member, ch(), ['2026-10-26', '2026-10-28'], '2026-10-28')).toEqual({ activeDays: 2, lastDay: '2026-10-28' });
  });

  test('nunca passa de 1 por dia de calendário desde o último dia contado', () => {
    // tinha 1 (dia 27); um treino lançado depois no dia 26 mais um no dia 28 dão só +1 (as regras recusariam +2)
    const member = { activeDays: 1, lastDay: '2026-10-27' };
    expect(nextScore(member, ch(), ['2026-10-26', '2026-10-27', '2026-10-28'], '2026-10-28')).toEqual({ activeDays: 2, lastDay: '2026-10-28' });
  });

  test('não grava quando nada mudou, quando diminuiria ou com o desafio encerrado', () => {
    expect(nextScore({ activeDays: 2, lastDay: '2026-10-28' }, ch(), ['2026-10-26', '2026-10-28'], '2026-10-28')).toBeNull();
    expect(nextScore({ activeDays: 3, lastDay: '2026-10-28' }, ch(), ['2026-10-28'], '2026-10-29')).toBeNull();
    expect(nextScore({ activeDays: 0, lastDay: '' }, ch({ status: 'ended' }), ['2026-10-26'], '2026-10-28')).toBeNull();
    expect(nextScore({ activeDays: 0, lastDay: '' }, ch(), [], '2026-10-28')).toBeNull();
    expect(nextScore({ activeDays: 0, lastDay: '' }, ch(), ['2026-10-30'], '2026-10-28')).toBeNull();   // futuro
  });
});

describe('placar', () => {
  test('mais dias primeiro, empate na mesma posição, marca quem sou eu', () => {
    const rows = rankMembers([
      { uid: 'a', displayName: 'Ana', activeDays: 2, lastDay: '2026-10-28' },
      { uid: 'b', displayName: 'Bia', activeDays: 4, lastDay: '2026-10-29' },
      { uid: 'c', displayName: 'Caio', activeDays: 2, lastDay: '2026-10-27' },
      { uid: 'd', displayName: 'Davi', activeDays: 0, lastDay: '' }
    ], 'a');
    expect(rows.map((r) => [r.uid, r.position])).toEqual([['b', 1], ['c', 2], ['a', 2], ['d', 4]]);
    expect(rows.find((r) => r.uid === 'a').me).toBe(true);
  });
});

describe('validação', () => {
  test('nome e duração', () => {
    expect(validateChallengeInput({ name: 'Novembro', durationDays: 7 })).toBe('');
    expect(validateChallengeInput({ name: '  ', durationDays: 7 })).toMatch(/nome/);
    expect(validateChallengeInput({ name: 'x'.repeat(41), durationDays: 7 })).toMatch(/40/);
    expect(validateChallengeInput({ name: 'veja site.com/x', durationDays: 7 })).toMatch(/links/);
    expect(validateChallengeInput({ name: 'Ok', durationDays: 10 })).toMatch(/7 ou 30/);
  });
  test('código normalizado', () => {
    expect(normalizeChallengeCode(' ab-cd 12 34 ')).toBe('ABCD1234');
  });
});
