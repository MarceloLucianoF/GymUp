import { buildPostPayload, cleanTitle, mergePosts, postLine, timeAgo } from './feed';

describe('feed', () => {
  test('cleanTitle remove links e e-mails e limita o tamanho', () => {
    expect(cleanTitle('Peito https://x.com/a e a@b.com')).toBe('Peito e');
    expect(cleanTitle('x'.repeat(100))).toHaveLength(60);
    expect(cleanTitle('   ')).toBe('Treino');
  });

  test('buildPostPayload respeita os limites das regras e não leva carga', () => {
    const p = buildPostPayload('u1', { trainingName: 'Treino A', durationSeconds: 3000, setsCompleted: 999, exercisesCount: 0, newRecords: 2, weekCount: 30 }, '2026-10-21T10:00:00.000Z');
    expect(p).toEqual({ authorId: 'u1', kind: 'workout', title: 'Treino A', minutes: 50, workSets: 300, exercises: 1, records: 2, weekCount: 14, createdAt: '2026-10-21T10:00:00.000Z' });
    expect(buildPostPayload('u1', { durationSeconds: 5 }).minutes).toBe(1);
  });

  test('postLine, mergePosts e timeAgo', () => {
    expect(postLine({ minutes: 50, workSets: 12, records: 1 })).toBe('50 min · 12 séries · 1 recorde');
    expect(postLine({ minutes: 50, workSets: 12, records: 0 })).toBe('50 min · 12 séries');
    expect(postLine({ minutes: 50, workSets: 12, records: 0, weekCount: 3 })).toBe('50 min · 12 séries · 3º treino da semana');
    const merged = mergePosts([[{ id: 'a', createdAt: '2026-10-20' }], [{ id: 'b', createdAt: '2026-10-21' }]], 1);
    expect(merged.map((x) => x.id)).toEqual(['b']);
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(timeAgo('2026-10-21T11:59:40Z', now)).toBe('agora');
    expect(timeAgo('2026-10-21T10:00:00Z', now)).toBe('há 2 h');
    expect(timeAgo('2026-10-20T10:00:00Z', now)).toBe('ontem');
  });
});

describe('curtidas recebidas', () => {
  const { newLikes, likeAlertText } = require('./feed');
  const items = [
    { postId: 'p1', title: 'Peito', likerId: 'a', at: '2026-10-21T12:00:00.000Z' },
    { postId: 'p2', title: 'Costas', likerId: 'a', at: '2026-10-20T08:00:00.000Z' },
    { postId: 'p1', title: 'Peito', likerId: 'b', at: '2026-10-19T08:00:00.000Z' }
  ];
  test('newLikes respeita o último visto e, sem ele, só as últimas 24 h', () => {
    expect(newLikes(items, '2026-10-20T00:00:00.000Z').length).toBe(2);
    expect(newLikes(items, '', Date.parse('2026-10-21T13:00:00.000Z')).map((l) => l.postId)).toEqual(['p1']);
  });
  test('likeAlertText', () => {
    expect(likeAlertText(items.slice(0, 1), { a: 'Ana' })).toBe('Ana curtiu seu treino "Peito".');
    expect(likeAlertText(items.slice(0, 2), { a: 'Ana' })).toBe('Ana curtiu 2 treinos seus.');
    expect(likeAlertText(items, {})).toBe('3 curtidas novas nos seus treinos.');
    expect(likeAlertText([], {})).toBe('');
  });
});

test('weekCountOf conta só desde segunda-feira', () => {
  const { weekCountOf } = require('./feed');
  const now = new Date(2026, 9, 22, 12);   // quinta, 22/10/2026
  const rows = [{ date: new Date(2026, 9, 19, 7).toISOString() }, { date: new Date(2026, 9, 22, 8).toISOString() }, { date: new Date(2026, 9, 18, 20).toISOString() }, { date: 'x' }];
  expect(weekCountOf(rows, now)).toBe(2);
});
