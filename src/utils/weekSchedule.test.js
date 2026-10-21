import { parsePlanned, weekStatus, weekdayIndex } from './weekSchedule';

const w = (id, name) => ({ id, docId: id.replace('my_', ''), name });
const mine = [w('my_a', 'Semana · Seg · Peito e Tríceps'), w('my_b', 'Semana · Qua · Costas e Bíceps'), w('my_c', 'Semana · Sex · Pernas Completo'), w('my_d', 'Semana · Sáb · Cardio'), w('my_x', 'Meu treino de braço')];
const at = (iso) => new Date(iso).getTime();
const WED = at('2026-10-21T15:00:00-03:00');   // quarta-feira
const ci = (trainingId, iso) => ({ trainingId, date: iso });

test('reconhece só os treinos da semana montada pela IA', () => {
  expect(parsePlanned(w('my_a', 'Semana · Seg · Peito e Tríceps'))).toMatchObject({ weekday: 0, label: 'Peito e Tríceps' });
  expect(parsePlanned(w('my_s', 'Semana · Dom · Alongamento e mobilidade'))).toMatchObject({ weekday: 6 });
  expect(parsePlanned(w('my_x', 'Meu treino de braço'))).toBeNull();
  expect(weekdayIndex(new Date('2026-10-19T12:00:00-03:00'))).toBe(0);   // segunda
  expect(weekdayIndex(new Date('2026-10-25T12:00:00-03:00'))).toBe(6);   // domingo
});

test('sem semana montada devolve null', () => {
  expect(weekStatus({ mine: [w('my_x', 'Meu treino')], history: [], now: WED })).toBeNull();
});

test('quarta: o de hoje é Costas e Bíceps; Peito de segunda ficou atrasado; o próximo é sexta', () => {
  const s = weekStatus({ mine, history: [], now: WED });
  expect(s.today.label).toBe('Costas e Bíceps');
  expect(s.doneToday).toBe(false);
  expect(s.overdue.map((o) => o.label)).toEqual(['Peito e Tríceps']);
  expect(s.next).toBeNull();                       // hoje ainda não foi feito: o foco é o de hoje
  expect(s.total).toBe(4);
});

test('treino de hoje concluído: o próximo é o da sexta; treinos de semanas anteriores não contam', () => {
  const s = weekStatus({ mine, history: [ci('my_b', '2026-10-21T10:00:00-03:00'), ci('my_a', '2026-10-19T10:00:00-03:00'), ci('my_c', '2026-10-12T10:00:00-03:00')], now: WED });
  expect(s.doneToday).toBe(true);
  expect(s.overdue).toEqual([]);
  expect(s.next.label).toBe('Pernas Completo');
  expect(s.doneCount).toBe(2);
  expect(s.items.find((i) => i.label === 'Pernas Completo').done).toBe(false);   // o de 12/10 é da semana passada
});

test('dia sem treino planejado e semana concluída', () => {
  const thu = at('2026-10-22T09:00:00-03:00');
  const s = weekStatus({ mine, history: [], now: thu });
  expect(s.today).toBeNull();
  expect(s.next.label).toBe('Pernas Completo');
  const all = weekStatus({ mine, history: mine.slice(0, 4).map((m) => ci(m.id, '2026-10-21T08:00:00-03:00')), now: WED });
  expect(all.allDone).toBe(true);
});
