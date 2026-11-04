jest.mock('firebase/ai', () => ({ getAI: jest.fn(), getGenerativeModel: jest.fn(), GoogleAIBackend: jest.fn(), Schema: {} }));
jest.mock('../firebase/config', () => ({ auth: {}, app: {}, db: {} }));

const { TRAINING_GUIDE, estimateTokens } = require('./aiTrainingGuide');
const { SAFETY_RULES } = require('./aiSafety');
const { buildContextInstruction } = require('./aiService');

test('o guia cabe no orçamento de ~1.200 tokens', () => {
  expect(estimateTokens(TRAINING_GUIDE)).toBeLessThanOrEqual(1200);
});

test('o guia traz as regras citáveis do feedback (divisão, volume, mínimos por grupo, ênfase e variação)', () => {
  expect(TRAINING_GUIDE).toMatch(/não junte dois grupos grandes no mesmo dia \(peito\+costas/);
  expect(TRAINING_GUIDE).toMatch(/10-20 para peito, costas e pernas; 6-10 para bíceps/);
  expect(TRAINING_GUIDE).toMatch(/6 de costas \+ 2 de bíceps/);
  expect(TRAINING_GUIDE).toMatch(/Costas: ao menos 1 puxada vertical .* 2 remadas e 1 isolador/);
  expect(TRAINING_GUIDE).toMatch(/Peito: ao menos 1 inclinado, 1 reto/);
  expect(TRAINING_GUIDE).toMatch(/Peito superior: Supino Inclinado/);
  expect(TRAINING_GUIDE).toMatch(/a cada 4-6 semanas/);
});

test('o prompt do chat (NVIDIA) leva o guia, o escopo fechado e só o nome recebido', () => {
  const nutrition = { targetCalories: 2000, tdee: 2400, macros: { protein: { grams: 160 }, carbs: { grams: 200 }, fats: { grams: 60 } }, mealSuggestions: { hydrationWaterMl: 3000 } };
  const text = buildContextInstruction({ name: 'Ana', goal: 'Hipertrofia', weightNum: 62, heightNum: 165, nutrition, historyText: 'x', experience: 'intermediario' });
  expect(text).toContain(TRAINING_GUIDE);
  expect(text).toContain(SAFETY_RULES);
  expect(text).toMatch(/experiência intermediario/);
  expect(text).not.toMatch(/@/);
});
