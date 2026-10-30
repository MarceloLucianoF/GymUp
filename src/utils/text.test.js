import { stripEmojis, plural } from './text';

describe('plural', () => {
  test('usa o singular só para 1', () => {
    expect(plural(1, 'série', 'séries')).toBe('1 série');
    expect(plural(0, 'série', 'séries')).toBe('0 séries');
    expect(plural(3, 'aluno usa', 'alunos usam')).toBe('3 alunos usam');
    expect(plural('1', 'treino', 'treinos')).toBe('1 treino');
  });
});

describe('stripEmojis', () => {
  test('remove emojis comuns e limpa espaços', () => {
    expect(stripEmojis('Ótimo treino 💪🔥 hoje!')).toBe('Ótimo treino hoje!');
    expect(stripEmojis('Meta batida ✅')).toBe('Meta batida');
    expect(stripEmojis('💡 Dica: beba água 💧')).toBe('Dica: beba água');
  });

  test('remove sequências compostas (ZWJ, variação, bandeiras, keycap)', () => {
    expect(stripEmojis('🏋️‍♂️ Supino')).toBe('Supino');
    expect(stripEmojis('🇧🇷 Brasil')).toBe('Brasil');
    expect(stripEmojis('1️⃣ Primeiro')).toBe('1 Primeiro');
  });

  test('preserva texto normal, acentos, markdown, setas e números', () => {
    const text = '### Metas\n* **Proteína:** 164 g (~2,2 g/kg)\n→ próximo passo — descanso • 8x10';
    expect(stripEmojis(text)).toBe(text);
  });

  test('entradas vazias ou inválidas', () => {
    expect(stripEmojis('')).toBe('');
    expect(stripEmojis(null)).toBe('');
    expect(stripEmojis(undefined)).toBe('');
    expect(stripEmojis(42)).toBe('42');
  });

  test('mantém quebras de linha entre parágrafos', () => {
    expect(stripEmojis('Linha 1 🔥\n\nLinha 2 ✨')).toBe('Linha 1\n\nLinha 2');
  });
});
