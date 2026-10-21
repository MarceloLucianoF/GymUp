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
    const base = calcNutrition({ weight: 70, height: 180, age: 25, goal: 'x' });
    expect(calcNutrition({ goal: 'Força' }).targetCalories).toBe(base.tdee + 250);
  });

  it('usa defaults para valores inválidos e calcula hidratação', () => {
    const r = calcNutrition({ weight: 'abc', height: '', age: 'x' });
    expect(r.bmr).toBe(Math.round(10 * 70 + 6.25 * 180 - 5 * 25 + 5));
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

describe('sem emojis nas respostas da IA', () => {
  const { buildContextInstruction } = jest.requireActual('./aiService');

  test('o prompt da NVIDIA proíbe emojis', () => {
    const nutrition = { targetCalories: 2000, tdee: 2400, macros: { protein: { grams: 160 }, carbs: { grams: 200 }, fats: { grams: 60 } }, mealSuggestions: { hydrationWaterMl: 3000 } };
    const text = buildContextInstruction({ name: 'Ana', goal: 'Hipertrofia', weightNum: 62, heightNum: 165, nutrition, historyText: 'x' });
    expect(text).toMatch(/NUNCA use emojis/);
  });
});

describe('equipamentos da academia do aluno', () => {
  const { aiService: svc } = require('./aiService');
  const { InsufficientExercisesError } = require('../utils/workoutComposer');
  test('gerador local só usa o que o aluno tem', () => {
    const w = svc.generateLocalWorkout({ muscleFocus: 'Full Body (Corpo Todo)', equipment: ['halter', 'livre'] });
    expect(w.exercises.length).toBeGreaterThan(2);
    const { exercises } = require('../data/exercises');
    const { equipmentOptions } = require('../utils/equipment');
    w.exercises.forEach((e) => {
      const ref = exercises.find((x) => x.name === e.name);
      expect(equipmentOptions(ref).some((o) => ['halter', 'livre'].includes(o))).toBe(true);
    });
  });
  test('pouquíssimos equipamentos dão erro claro em vez de ficha fora do que ele tem', () => {
    expect(() => svc.generateLocalWorkout({ muscleFocus: 'Full Body (Corpo Todo)', equipment: ['cardio'] })).toThrow(InsufficientExercisesError);
  });
  test('sem escolha continua como antes', () => {
    expect(svc.generateLocalWorkout({ muscleFocus: 'Peito e Tríceps' }).exercises.length).toBeGreaterThan(2);
  });
});

describe('exercícios próprios do aluno no gerador', () => {
  const { aiService: svc } = require('./aiService');
  const mine = [
    { id: 'mine_1', firestoreId: 'mine_1', name: 'Remada do condomínio', muscleGroup: 'costas', equipment: 'halter', kind: 'strength', sets: 4, reps: 10, rest: 60, description: 'banco 3', machineImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==', mine: true },
    { id: 'mine_2', firestoreId: 'mine_2', name: 'Puxada do prédio', muscleGroup: 'costas', equipment: 'polia', kind: 'strength', sets: 3, reps: 12, rest: 60, description: '', machineImage: null, mine: true },
    { id: 'mine_3', firestoreId: 'mine_3', name: 'Rosca no cano', muscleGroup: 'biceps', equipment: 'barra', kind: 'strength', sets: 3, reps: 10, rest: 60, description: '', machineImage: null, mine: true }
  ];
  test('o gerador local inclui até 2 exercícios do aluno do grupo pedido, com a foto, e mantém a divisão', () => {
    const w = svc.generateLocalWorkout({ muscleFocus: 'Costas e Bíceps', userRequest: 'monte um treino de costas', customExercises: mine });
    const names = w.exercises.map((e) => e.name);
    const own = names.filter((n) => /condomínio|prédio/.test(n));   // costas
    expect(own.length).toBeGreaterThanOrEqual(1);
    expect(own.length).toBeLessThanOrEqual(2);
    expect(names.length).toBe(5);   // a divisão do foco (costas e bíceps) continua com o mesmo total
    expect(w.exercises.find((e) => /condomínio/.test(e.name))?.machineImage).toMatch(/^data:image\/jpeg/);
    expect(w.exercises.every((e) => e.kind === undefined || ['strength', 'timed', 'cardio'].includes(e.kind))).toBe(true);
    expect(w.exercises.every((e) => !('kind' in e) || e.kind !== undefined)).toBe(true);   // nunca "undefined" (o Firestore recusa)
  });
  test('respeita os equipamentos da academia: sem halter, a remada de halter do aluno não entra', () => {
    const w = svc.generateLocalWorkout({ muscleFocus: 'Costas e Bíceps', userRequest: 'monte um treino de costas', customExercises: mine, equipment: ['maquina', 'polia'] });
    const names = w.exercises.map((e) => e.name);
    expect(names).not.toContain('Remada do condomínio');
    expect(names).toContain('Puxada do prédio');
  });
  test('sem exercícios do aluno nada muda, e pedido de outro grupo não recebe os dele', () => {
    const w = svc.generateLocalWorkout({ muscleFocus: 'Peito e Tríceps', userRequest: 'monte um treino de peito', customExercises: mine });
    expect(w.exercises.map((e) => e.name).join('|')).not.toMatch(/condomínio|prédio|cano/);
  });
  test('na versão com IA, o exercício do aluno entra mesmo que a IA não o tenha escolhido', async () => {
    const { generatePlan, normalizeLibrary, specFromFocus, parseRequest } = require('../utils/workoutComposer');
    const { exercises } = require('../data/exercises');
    const library = normalizeLibrary([...mine, ...exercises]);
    const spec = parseRequest('treino de costas');
    const askModel = async (prompt) => {
      const catalog = JSON.parse(prompt.match(/Candidatos: (\[.*\])\n/)[1]).filter((c) => !/condominio|predio/.test(c.id));
      return JSON.stringify({ name: 'Costas IA', exercises: catalog.filter((c) => c.primaryGroup === 'costas').slice(0, 5).map((c) => ({ id: c.id, sets: 3, reps: '10', rest: 60 })) });
    };
    const plan = await generatePlan({ spec, library, total: 5, goal: 'Hipertrofia', durationMinutes: 45, askModel });
    expect(plan.source).toBe('ia');
    expect(plan.exercises.some((e) => /condomínio|prédio/.test(e.name))).toBe(true);
    expect(specFromFocus).toBeDefined();
  });
});
