jest.mock('firebase/ai', () => ({
  getAI: jest.fn(),
  getGenerativeModel: jest.fn(),
  GoogleAIBackend: jest.fn(),
  Schema: { object: jest.fn(), number: jest.fn(), string: jest.fn(), array: jest.fn(), boolean: jest.fn(), enumString: jest.fn(), integer: jest.fn() },
}));
jest.mock('../firebase/config', () => ({ auth: {}, app: {}, db: {} }));

const { calcNutrition } = require('./aiService');

describe('calcNutrition', () => {
  it('calcula BMR/TDEE com a fórmula de Mifflin-St Jeor', () => {
    const r = calcNutrition({ weight: 80, height: 180, age: 30, goal: 'Manutenção' });
    expect(r.bmr).toBe(1780);
    expect(r.tdee).toBe(2581);
    expect(r.targetCalories).toBe(2581);
  });

  it('hipertrofia adiciona superávit de 350 kcal', () => {
    const base = calcNutrition({ weight: 80, height: 180, age: 30, goal: 'x' });
    const r = calcNutrition({ weight: 80, height: 180, age: 30, goal: 'Hipertrofia' });
    expect(r.targetCalories).toBe(base.tdee + 350);
    expect(r.macros.protein.grams).toBe(160);
  });

  it('emagrecimento reduz calorias, com piso de 1400 e mais proteína', () => {
    const r = calcNutrition({ weight: 50, height: 150, age: 60, goal: 'Emagrecimento' });
    expect(r.targetCalories).toBeGreaterThanOrEqual(1400);
    expect(r.macros.protein.grams).toBe(110);
  });

  it('força usa superávit de 250 kcal', () => {
    const base = calcNutrition({ weight: 70, height: 175, age: 25, goal: 'x' });
    expect(calcNutrition({ goal: 'Força' }).targetCalories).toBe(base.tdee + 250);
  });

  it('usa defaults para valores inválidos e calcula hidratação', () => {
    const r = calcNutrition({ weight: 'abc', height: '', age: 'x' });
    expect(r.bmr).toBe(Math.round(10 * 70 + 6.25 * 175 - 5 * 25 + 5));
    expect(r.mealSuggestions.hydrationWaterMl).toBe(2800);
  });

  it('macros somam aproximadamente 100%', () => {
    const { macros } = calcNutrition({ weight: 75, height: 178, age: 28, goal: 'Hipertrofia' });
    const sum = macros.protein.percent + macros.carbs.percent + macros.fats.percent;
    expect(sum).toBeGreaterThanOrEqual(98);
    expect(sum).toBeLessThanOrEqual(102);
  });
});

describe('roteamento e proteção da rota NVIDIA', () => {
  const { needsTools, looksLikeToolCall, buildContextInstruction } = jest.requireActual('./aiService');

  test('needsTools detecta pedido de montar/gerar ficha', () => {
    expect(needsTools('Monte um treino de peito para mim')).toBe(true);
    expect(needsTools('gere uma ficha de pernas')).toBe(true);
    expect(needsTools('Como foi meu último treino?')).toBe(false);
    expect(needsTools('quais as melhores dicas de dieta?')).toBe(false);
    expect(needsTools(null)).toBe(false);
  });

  test('looksLikeToolCall pega JSON de ação simulado, mas não texto normal', () => {
    expect(looksLikeToolCall('{ "action": "get_last_workout", "parameters": {} }')).toBe(true);
    expect(looksLikeToolCall('[{"name":"calcular_macros","arguments":{}}]')).toBe(true);
    expect(looksLikeToolCall('Seu último treino foi o Treino A.')).toBe(false);
    expect(looksLikeToolCall('{texto entre chaves sem json}')).toBe(false);
  });

  test('o prompt da NVIDIA traz os dados e proíbe chamadas de função', () => {
    const nutrition = { targetCalories: 2000, tdee: 2400, macros: { protein: { grams: 160 }, carbs: { grams: 200 }, fats: { grams: 60 } }, mealSuggestions: { hydrationWaterMl: 3000 } };
    const text = buildContextInstruction({ name: 'Ana', goal: 'Hipertrofia', weightNum: 62, heightNum: 165, nutrition, historyText: 'Treino #1 - Treino A' });
    expect(text).toMatch(/2000 kcal/);
    expect(text).toMatch(/Treino #1 - Treino A/);
    expect(text).toMatch(/NUNCA escreva JSON/);
    expect(text).not.toMatch(/CHAME as funções/);
  });
});
