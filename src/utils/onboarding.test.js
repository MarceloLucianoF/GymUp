import {
  validateName, validateGoal, validateBody, validateExperience, validateCoachCode,
  validateStep, calcBmi, bmiCategory, suggestPlan, buildPayload, buildSkipPayload,
} from './onboarding';

describe('validação', () => {
  test('nome', () => {
    expect(validateName(' a ')).not.toBe('');
    expect(validateName('Ana')).toBe('');
  });
  test('objetivo', () => {
    expect(validateGoal('Força')).toBe('');
    expect(validateGoal('x')).not.toBe('');
  });
  test('corpo', () => {
    expect(validateBody({ age: '25', weight: '70,5', height: '175' })).toBe('');
    expect(validateBody({ age: '', weight: '70', height: '175' })).toMatch(/idade/i);
    expect(validateBody({ age: '11', weight: '70', height: '175' })).toMatch(/12 e 90/);
    expect(validateBody({ age: '25', weight: '301', height: '175' })).toMatch(/Peso/);
    expect(validateBody({ age: '25', weight: '70', height: '99' })).toMatch(/Altura/);
    expect(validateBody({ age: '25.5', weight: '70', height: '175' })).not.toBe('');
  });
  test('experiência', () => {
    expect(validateExperience({ experience: 'avancado', weeklyGoal: 5 })).toBe('');
    expect(validateExperience({ experience: '', weeklyGoal: 5 })).not.toBe('');
    expect(validateExperience({ experience: 'iniciante', weeklyGoal: 8 })).not.toBe('');
  });
  test('código do treinador', () => {
    expect(validateCoachCode('')).toBe('');
    expect(validateCoachCode('abc DEF')).not.toBe('');
    expect(validateCoachCode('Abc123xyz')).toBe('');
  });
  test('validateStep delega', () => {
    expect(validateStep(1, { goal: '' })).not.toBe('');
    expect(validateStep(2, { age: 20, weight: 60, height: 170 })).toBe('');
  });
});

describe('IMC', () => {
  test('cálculo e categoria', () => {
    expect(calcBmi(70, 175)).toBe(22.9);
    expect(calcBmi('', 175)).toBeNull();
    expect(bmiCategory(17)).toBe('Abaixo do peso');
    expect(bmiCategory(22.9)).toBe('Peso saudável');
    expect(bmiCategory(27)).toBe('Sobrepeso');
    expect(bmiCategory(31)).toBe('Obesidade');
  });
});

describe('plano', () => {
  test('limita iniciante a 4 dias', () => {
    const p = suggestPlan({ goal: 'Hipertrofia', experience: 'iniciante', weeklyGoal: 7 });
    expect(p.days).toBe(4);
    expect(p.adjusted).toBe(true);
  });
  test('avançado mantém e define divisão', () => {
    const p = suggestPlan({ goal: 'Força', experience: 'avancado', weeklyGoal: 5 });
    expect(p.days).toBe(5);
    expect(p.split).toMatch(/ABC/);
    expect(p.quote).toBeTruthy();
  });
});

describe('payload', () => {
  const data = { displayName: ' Ana ', goal: 'Força', age: '30', weight: '70,5', height: '170', experience: 'iniciante', weeklyGoal: 3, coachId: ' coach123 ' };
  const now = new Date('2026-01-01T00:00:00Z');
  test('campos exatos do contrato', () => {
    const p = buildPayload(data, { now });
    expect(Object.keys(p).sort()).toEqual(['age', 'coachId', 'displayName', 'experience', 'goal', 'height', 'onboardedAt', 'updatedAt', 'weeklyGoal', 'weight'].sort());
    expect(p.weight).toBe(70.5);
    expect(p.displayName).toBe('Ana');
    expect(p.coachId).toBe('coach123');
  });
  test('sem coachId', () => {
    expect(buildPayload(data, { withCoach: false, now })).not.toHaveProperty('coachId');
    expect(buildPayload({ ...data, coachId: '' }, { now })).not.toHaveProperty('coachId');
  });
  test('pular', () => {
    expect(Object.keys(buildSkipPayload(now)).sort()).toEqual(['onboardedAt', 'updatedAt']);
  });
});
