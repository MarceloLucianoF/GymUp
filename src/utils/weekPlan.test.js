import { chooseSplit, freeWeekdays, localPlanText, pickFreeDay, planAiMessages, planFacts, planTextMatches, saveDescription, saveName } from './weekPlan';

describe('divisão da semana', () => {
  test('quantidade de dias e foco de cada um', () => {
    expect(chooseSplit(2).map((d) => d.focus)).toEqual(['Full Body (Corpo Todo)', 'Full Body (Corpo Todo)']);
    expect(chooseSplit(3, 'iniciante').map((d) => d.label)).toEqual(['Corpo todo A', 'Corpo todo B', 'Corpo todo C']);
    expect(chooseSplit(3, 'intermediário').map((d) => d.focus)).toEqual(['Peito e Tríceps', 'Costas e Bíceps', 'Pernas + Ombros']);
    expect(chooseSplit(4)).toHaveLength(4);
    expect(chooseSplit(5).map((d) => d.focus)).toContain('Posterior e Glúteos');
    expect(chooseSplit(6)).toHaveLength(6);
    expect(chooseSplit(99)).toHaveLength(6);
    expect(chooseSplit(1)).toHaveLength(2);
  });
  test('dias da semana espaçados e sem repetição; letras só quando o foco se repete', () => {
    const s3 = chooseSplit(3, 'avancado');
    expect(s3.map((d) => d.weekday)).toEqual([0, 2, 4]);
    expect(chooseSplit(2).map((d) => d.weekday)).toEqual([0, 3]);
    [2, 3, 4, 5, 6].forEach((n) => expect(new Set(chooseSplit(n).map((d) => d.weekday)).size).toBe(n));
    expect(chooseSplit(4).map((d) => d.label)).toEqual(['Peito e Tríceps', 'Costas e Bíceps', 'Pernas Completo', 'Ombros e ABS']);
    expect(chooseSplit(2).map((d) => d.occurrence)).toEqual([1, 2]);
  });
  test('dias livres para cardio e alongamento', () => {
    const free = freeWeekdays(chooseSplit(3, 'avancado'));
    expect(free).toEqual([1, 3, 5, 6]);
    expect(pickFreeDay(free, [])).toBe(5);
    expect(pickFreeDay(free, [5])).toBe(3);
    expect(pickFreeDay([], [])).toBeNull();
  });
});

describe('texto da semana', () => {
  const day = (weekday, label, n, kind = 'strength', mine = 0) => ({ weekday, label, kind, workout: { exercises: Array.from({ length: n }, (_, i) => ({ name: `E${i}`, firestoreId: i < mine ? `mine_${i}` : `ex${i}` })) } });
  const plan = { goal: 'Hipertrofia', durationMinutes: 45, days: [day(0, 'Peito e Tríceps', 5, 'strength', 1), day(2, 'Costas e Bíceps', 5), day(4, 'Pernas Completo', 5), day(5, 'Cardio', 4, 'cardio')] };
  test('fatos e texto local', () => {
    expect(planFacts(plan)).toMatchObject({ days: 3, exercises: 19, minutesPerDay: 45, own: 1 });
    const t = localPlanText(plan);
    expect(t).toMatch(/Semana de 3 treinos de cerca de 45 minutos, pensada para hipertrofia\./);
    expect(t).toMatch(/Segunda: Peito e Tríceps; Quarta: Costas e Bíceps; Sexta: Pernas Completo/);
    expect(t).toMatch(/Extras nos dias livres: Sábado: Cardio/);
    expect(t).toMatch(/Inclui 1 exercício criado por você/);
  });
  test('texto da IA só vale com números dos fatos e sem emoji', () => {
    expect(planTextMatches('Você treina 3 vezes na semana, com 45 minutos por treino, alternando peito, costas e pernas.', plan)).toBe(true);
    expect(planTextMatches('Você treina 5 vezes na semana, com 45 minutos por treino, alternando peito, costas e pernas.', plan)).toBe(false);
    expect(planTextMatches('Você treina 3 vezes na semana 💪 com bastante variedade de exercícios.', plan)).toBe(false);
    expect(planTextMatches('Boa semana!', plan)).toBe(false);
    const [sys, user] = planAiMessages(plan);
    expect(sys.content).toMatch(/SOMENTE os números/);
    expect(JSON.parse(user.content)).toMatchObject({ dias_de_treino: 3, minutos_por_treino: 45 });
  });
  test('nome e descrição para salvar cada dia', () => {
    expect(saveName({ weekday: 0, label: 'Peito e Tríceps' })).toBe('Semana · Seg · Peito e Tríceps');
    expect(saveDescription({ weekday: 1 })).toBe('Parte da semana montada pela IA. Sugerido para terça-feira.');
    expect(saveDescription({ weekday: 5 })).toBe('Parte da semana montada pela IA. Sugerido para sábado.');
  });
});
