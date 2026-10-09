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
