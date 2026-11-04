import { frequentExercises, generatedHistory, recentListsFromHistory, rememberGenerated, varietyContext } from './aiVariety';

const ci = (...names) => ({ trainingName: 'T', exercises: names.map((name) => ({ name, sets: [{ weight: 10, reps: 10 }] })) });

beforeEach(() => window.localStorage.clear());

test('listas dos check-ins e exercícios mais feitos (só nomes)', () => {
  const docs = [ci('Puxada', 'Remada'), ci('Puxada', 'Rosca'), ci('Supino')];
  expect(recentListsFromHistory(docs, 2)).toEqual([['Puxada', 'Remada'], ['Puxada', 'Rosca']]);
  expect(frequentExercises(docs)).toEqual(['Puxada']);
});

test('guarda as fichas geradas (mais recente primeiro, sem duplicar) e junta tudo no contexto', () => {
  rememberGenerated({ exercises: [{ name: 'A' }, { name: 'B' }] });
  rememberGenerated({ exercises: [{ name: 'C' }] });
  rememberGenerated({ exercises: [{ name: 'A' }, { name: 'B' }] });
  expect(generatedHistory()).toEqual([['A', 'B'], ['C']]);
  const ctx = varietyContext({ historyDocs: [ci('B', 'A'), ci('X', 'X')], extraLists: [[{ name: 'Z' }]] });
  expect(ctx.lists[0]).toEqual(['Z']);
  expect(ctx.lists.filter((l) => [...l].sort().join() === 'A,B')).toHaveLength(1);   // ficha gerada e treino feito iguais contam uma vez
  expect(JSON.stringify(ctx)).not.toMatch(/weight|reps|trainingName/);
});

test('armazenamento corrompido não quebra', () => {
  window.localStorage.setItem('bohtreinar_ai_recent_v1', '{oops');
  expect(generatedHistory()).toEqual([]);
});
