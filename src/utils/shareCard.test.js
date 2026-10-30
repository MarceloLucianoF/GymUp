import { drawShareCard, shareCardData, wrapLines } from './shareCard';

const stats = { trainingName: 'Treino A · Peito e tríceps', timeStr: '48m 10s', volumeKg: 12345.6, completedSetsCount: 13, executedExercisesCount: 4, newPRs: ['Supino Reto com Barra'] };
const facts = { exercises: [
  { name: 'Supino Reto com Barra', trend: 'load', delta: 2.5 },
  { name: 'Tríceps Corda', trend: 'reps', delta: 1 },
  { name: 'Crucifixo', trend: 'same', delta: 0 }
] };

test('dados da imagem: números formatados, recordes e só o que evoluiu', () => {
  const d = shareCardData(stats, facts, new Date('2026-10-30T12:00:00'));
  expect(d.title).toBe('Treino A · Peito e tríceps');
  expect(d.date).toMatch(/30 de outubro/);
  expect(d.stats).toEqual([['Tempo', '48m 10s'], ['Volume', '12.346 kg'], ['Séries', '13'], ['Exercícios', '4']]);
  expect(d.prs).toEqual(['Supino Reto com Barra']);
  expect(d.highlights).toEqual(['Supino Reto com Barra: +2,5 kg', 'Tríceps Corda: +1 repetição']);
  expect(JSON.stringify(d)).not.toMatch(/@/);
});

test('sem fatos nem nome do treino ainda gera dados válidos', () => {
  const d = shareCardData({}, null);
  expect(d.title).toBe('Treino');
  expect(d.highlights).toEqual([]);
  expect(d.stats[1][1]).toBe('0 kg');
});

test('quebra de linha respeita a largura e corta com reticências', () => {
  const ctx = { measureText: (t) => ({ width: t.length * 10 }) };
  expect(wrapLines(ctx, 'um dois tres quatro', 90, 3)).toEqual(['um dois', 'tres', 'quatro']);
  const cut = wrapLines(ctx, 'palavra palavra palavra palavra', 80, 2);
  expect(cut).toHaveLength(2);
  expect(cut[1].endsWith('…')).toBe(true);
});

test('sem canvas 2D devolve false (cai no compartilhar texto)', async () => {
  expect(await drawShareCard({ getContext: () => null }, shareCardData(stats, facts))).toBe(false);
});
