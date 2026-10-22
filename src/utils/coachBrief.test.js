import { buildCoachFacts, coachBriefMatches, coachBriefText } from './coachBrief';

const now = new Date(2026, 9, 22, 12).getTime();
const day = (n) => new Date(now - n * 24 * 3600 * 1000).toISOString();
const ci = (n, exs) => ({ date: day(n), exercises: exs });
const ex = (name, weight, reps, rpe) => ({ name, sets: [{ weight, reps, rpe, completed: true }, { weight: weight - 10, reps, type: 'warmup', completed: true }] });

const history = [
  ci(20, [ex('Supino', 60, 8), ex('Remada', 50, 10), ex('Agachamento', 80, 8, 9)]),
  ci(14, [ex('Supino', 62.5, 8), ex('Remada', 50, 10), ex('Agachamento', 80, 8, 9)]),
  ci(7, [ex('Supino', 65, 8), ex('Remada', 50, 9), ex('Agachamento', 80, 8, 9.5)]),
  ci(40, [ex('Supino', 40, 8)])   // fora das 4 semanas
];

test('fatos: treinos, progresso, estagnado e esforço alto (aquecimento não conta)', () => {
  const f = buildCoachFacts({ checkIns: history, weeklyGoal: 3, now });
  expect(f.workouts28).toBe(3);
  expect(f.daysSinceLast).toBe(7);
  expect(f.progressing).toEqual([{ name: 'Supino', from: '60', to: '65' }]);
  expect(f.stalled.map((s) => s.name)).toEqual(['Remada', 'Agachamento']);
  expect(f.hardEffort).toEqual(['Agachamento']);
});

test('texto local e validação da IA', () => {
  const f = buildCoachFacts({ checkIns: history, weeklyGoal: 3, now });
  const text = coachBriefText(f, 'Ana');
  expect(text).toMatch(/^Ana fez 3 treinos nas últimas 4 semanas/);
  expect(text).toMatch(/há 7 dias sem treinar/);
  expect(text).toMatch(/Supino \(60 para 65 kg\)/);
  expect(text).toMatch(/Parado em Remada \(50 kg em 3 treinos\)/);
  expect(coachBriefMatches('Ana treinou 3 vezes em 4 semanas e subiu o supino de 60 para 65 kg. Vale rever a remada, parada em 50 kg.', f, 'Ana')).toBe(true);
  expect(coachBriefMatches('Ana treinou 5 vezes em 4 semanas e subiu o supino de 60 para 70 kg, ótimo progresso.', f, 'Ana')).toBe(false);
  expect(coachBriefText(buildCoachFacts({ checkIns: [], now }), 'Bia')).toBe('Bia ainda não registrou treinos no app.');
});
