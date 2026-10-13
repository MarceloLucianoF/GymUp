import { recentRecords, daysAgoLabel } from './records';

const day = (n) => new Date(2026, 9, 12 - n, 12).toISOString();
const ci = (n, name, weight) => ({ date: day(n), exercises: [{ name, sets: [{ weight, reps: 8 }, { weight: weight - 5, reps: 8 }] }] });
const NOW = new Date(2026, 9, 12, 15);

describe('recordes recentes', () => {
  it('só conta quando passa de uma marca anterior, dentro da janela', () => {
    const history = [ci(30, 'Supino', 60), ci(10, 'Supino', 70), ci(2, 'Supino', 75), ci(1, 'Agachamento', 100)];
    expect(recentRecords(history, NOW)).toEqual([{ exercise: 'Supino', weight: 75, previous: 70, date: new Date(day(2)) }]);   // Agachamento: primeira marca, não é recorde
  });

  it('o primeiro registro de um exercício nunca é recorde; fora de 14 dias não aparece', () => {
    expect(recentRecords([ci(3, 'Remada', 50)], NOW)).toEqual([]);
    expect(recentRecords([ci(40, 'Remada', 50), ci(20, 'Remada', 60)], NOW)).toEqual([]);
  });

  it('ordena do mais recente e limita a quantidade', () => {
    const h = [ci(9, 'A', 10), ci(8, 'B', 10), ci(7, 'C', 10), ci(6, 'D', 10), ci(3, 'A', 20), ci(2, 'B', 20), ci(1, 'C', 20), ci(0, 'D', 20)];
    expect(recentRecords(h, NOW).map((r) => r.exercise)).toEqual(['D', 'C', 'B']);
    expect(recentRecords(h, NOW, { max: 1 })).toHaveLength(1);
  });

  it('séries não concluídas não contam; ontem vale pelo dia do calendário, mesmo com menos de 24 h', () => {
    const h = [ci(10, 'Supino', 60), { date: new Date(2026, 9, 11, 23, 55).toISOString(), exercises: [{ name: 'Supino', sets: [{ weight: 90, completed: false }, { weight: 70, completed: true }] }] }];
    const r = recentRecords(h, new Date(2026, 9, 12, 0, 10));
    expect(r[0].weight).toBe(70);                                  // o 90 não concluído foi ignorado
    expect(daysAgoLabel(new Date(2026, 9, 11, 23, 55), new Date(2026, 9, 12, 0, 10))).toBe('ontem');
  });

  it('ignora dados quebrados e rotula a data', () => {
    expect(recentRecords([{ date: 'x' }, { date: day(1), exercises: 'x' }, null].filter(Boolean), NOW)).toEqual([]);
    expect(daysAgoLabel(new Date(day(0)), NOW)).toBe('hoje');
    expect(daysAgoLabel(new Date(day(1)), NOW)).toBe('ontem');
    expect(daysAgoLabel(new Date(day(5)), NOW)).toBe('há 5 dias');
  });
});
