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
    const merged = mergePosts([[{ id: 'a', createdAt: '2026-10-20' }], [{ id: 'b', createdAt: '2026-10-21' }]], 1);
    expect(merged.map((x) => x.id)).toEqual(['b']);
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(timeAgo('2026-10-21T11:59:40Z', now)).toBe('agora');
    expect(timeAgo('2026-10-21T10:00:00Z', now)).toBe('há 2 h');
    expect(timeAgo('2026-10-20T10:00:00Z', now)).toBe('ontem');
  });
});
