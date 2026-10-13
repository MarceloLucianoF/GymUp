import {
  InsufficientExercisesError, allocate, catalogPayload, checkComposition, composeLocalPlan, generatePlan, normalizeLibrary, parseRequest, specFromFocus
} from './workoutComposer';
import templates from '../data/officialTemplates.json';
import { exercises as defaults } from '../data/exercises';

const L = (name, muscleGroup) => ({ name, muscleGroup, description: 'texto longo ' + name, machineImage: `/exercises/${name}.gif`, firestoreId: `fs_${name}`, difficulty: 'iniciante' });
// Biblioteca parecida com a real: braço e costas antes das pernas, rótulos misturados.
const FIX = [
  L('Rosca Alternada Máquina', 'braços'), L('Remada Articulada', 'costas'), L('Supino Máquina', 'peito'), L('Tríceps Máquina', 'braços'),
  L('Elevação Lateral Máquina', 'ombros'), L('Desenvolvimento Máquina', 'ombros'), L('Abdominal Máquina', 'core'),
  L('Hack Squat', 'pernas'), L('Agachamento com Halteres', 'pernas'), L('Afundo Livre com Halteres', 'pernas'), L('Cadeira Extensora', 'pernas'),
  L('Mesa Flexora', 'pernas'), L('Cadeira Flexora', 'pernas'), L('Hip Thrust Máquina', 'pernas'), L('Glúteo Máquina', 'pernas'),
  L('Cadeira Abdutora', 'pernas'), L('Cadeira Adutora', 'pernas'), L('Panturrilha Sentado Máquina', 'pernas'), L('Panturrilha em pé com Halteres', 'pernas'),
  L('Leg Press', 'perna')
];
const LIB = normalizeLibrary(FIX);
const names = (plan) => plan.exercises.map((e) => e.name);
const group = (plan, g) => plan.exercises.filter((e) => e.primaryGroup === g).length;
const sub = (plan, s) => plan.exercises.filter((e) => e.primarySub === s).length;
const allInLib = (plan) => plan.exercises.every((e) => FIX.some((f) => f.name === e.name));

test('metadados normalizados: grupo, subgrupo, equipamento, padrão, composto e dificuldade', () => {
  const lp = LIB.find((e) => e.name === 'Leg Press');
  expect(lp).toMatchObject({ id: 'leg_press', primaryGroup: 'pernas', primarySub: 'quadriceps', equipment: 'maquina', movementPattern: 'empurrar', isCompound: true, difficulty: 'iniciante' });
  expect(lp.subgroups).toEqual(expect.arrayContaining(['quadriceps', 'gluteos']));
  expect(LIB.find((e) => e.name === 'Mesa Flexora').primarySub).toBe('posterior');
  expect(LIB.find((e) => e.name === 'Hip Thrust Máquina').primarySub).toBe('gluteos');
  expect(LIB.find((e) => e.name === 'Panturrilha Sentado Máquina').primarySub).toBe('panturrilhas');
  expect(LIB.find((e) => e.name === 'Cadeira Adutora').primarySub).toBe('adutores');
  expect(LIB.find((e) => e.name === 'Tríceps Máquina').subgroups).toEqual(['triceps']);
});

test('interpreta o pedido: perna, quadríceps, posterior, glúteos, panturrilhas, misto e ambíguo', () => {
  expect(parseRequest('monte um treino de perna').parts).toEqual([{ group: 'pernas', focus: 'completo' }]);
  expect(parseRequest('treino de leg day').parts[0].focus).toBe('completo');
  expect(parseRequest('quero treino de quadríceps').parts[0].focus).toBe('quadriceps');
  expect(parseRequest('treino de posterior de coxa').parts[0].focus).toBe('posterior');
  expect(parseRequest('treino de glúteos e bumbum').parts[0].focus).toBe('gluteos');
  expect(parseRequest('treino de panturrilhas').parts[0].focus).toBe('panturrilhas');
  const mixed = parseRequest('treino de pernas + ombros');
  expect(mixed.mixed).toBe(true);
  expect(mixed.parts.map((p) => p.group)).toEqual(['pernas', 'ombros']);
  expect(allocate(mixed, 6)).toEqual([4, 2]);
  expect(parseRequest('treino de costas').label).toBe('Costas e Bíceps');
  // nome ambíguo ou sem grupo reconhecido: não chuta, a tela decide o foco
  expect(parseRequest('treino de agachamento')).toBeNull();
  expect(parseRequest('um treino legal')).toBeNull();
  expect(parseRequest('')).toBeNull();
});

test.each([
  ['perna', 'monte um treino de perna'],
  ['quadríceps', 'treino de quadríceps'],
  ['posterior', 'treino de posterior'],
  ['glúteos', 'treino de glúteos'],
  ['panturrilhas', 'treino de panturrilhas']
])('montagem local de %s: só da biblioteca, só pernas e com o foco na composição', (_n, text) => {
  const spec = parseRequest(text);
  const plan = composeLocalPlan({ spec, library: LIB, total: 6, goal: 'Hipertrofia' });
  expect(allInLib(plan)).toBe(true);
  expect(plan.exercises).toHaveLength(6);
  expect(group(plan, 'pernas')).toBe(6);
  expect(checkComposition(plan.exercises, spec, 6).ok).toBe(true);
  if (text.includes('quadr')) expect(sub(plan, 'quadriceps')).toBeGreaterThanOrEqual(3);
  if (text.includes('posterior')) expect(sub(plan, 'posterior') + sub(plan, 'gluteos')).toBeGreaterThanOrEqual(3);
  if (text.includes('glúteos')) expect(sub(plan, 'gluteos')).toBeGreaterThanOrEqual(3);
  if (text.includes('panturr')) expect(sub(plan, 'panturrilhas')).toBeGreaterThanOrEqual(2);
});

test('pernas completas cobre quadríceps, posterior/glúteos e panturrilha/adutores', () => {
  const plan = composeLocalPlan({ spec: parseRequest('treino de perna'), library: LIB, total: 6, goal: 'Hipertrofia' });
  expect(sub(plan, 'quadriceps')).toBeGreaterThanOrEqual(1);
  expect(sub(plan, 'posterior') + sub(plan, 'gluteos')).toBeGreaterThanOrEqual(1);
  expect(sub(plan, 'panturrilhas') + sub(plan, 'adutores')).toBeGreaterThanOrEqual(1);
  expect(plan.exercises[0].isCompound).toBe(true);
});

test('pernas + ombros: 4 de pernas e 2 de ombros, com a divisão informada', () => {
  const plan = composeLocalPlan({ spec: parseRequest('pernas + ombros'), library: LIB, total: 6, goal: 'Hipertrofia' });
  expect(group(plan, 'pernas')).toBe(4);
  expect(group(plan, 'ombros')).toBe(2);
  expect(plan.division).toBe('4 de pernas e 2 de ombros');
  expect(allInLib(plan)).toBe(true);
});

test('o foco da tela vale quando o pedido não diz o grupo', () => {
  const spec = parseRequest('treino de agachamento') || specFromFocus('Pernas Completo');
  const plan = composeLocalPlan({ spec, library: LIB, total: 5, goal: 'Força' });
  expect(group(plan, 'pernas')).toBe(5);
  expect(plan.exercises[0]).toMatchObject({ sets: '4', reps: '6', rest: 90 });
});

test('IA: resposta válida do modelo é usada, validada por ID', async () => {
  const ids = ['hack_squat', 'mesa_flexora', 'hip_thrust_maquina', 'cadeira_extensora', 'panturrilha_sentado_maquina'];
  const askModel = jest.fn().mockResolvedValue(JSON.stringify({ name: 'Perna da IA', description: 'curta', exercises: ids.map((id) => ({ id, sets: 4, reps: '8-10', rest: 90 })) }));
  const plan = await generatePlan({ spec: parseRequest('perna'), library: LIB, total: 5, goal: 'Hipertrofia', durationMinutes: 45, askModel });
  expect(plan.source).toBe('ia');
  expect(names(plan)).toEqual(['Hack Squat', 'Mesa Flexora', 'Hip Thrust Máquina', 'Cadeira Extensora', 'Panturrilha Sentado Máquina']);
});

test('IA: só recebe candidatos do foco com metadados mínimos (sem imagem, descrição nem ID do Firestore)', async () => {
  let prompt = '';
  await generatePlan({ spec: parseRequest('perna'), library: LIB, total: 5, goal: 'Hipertrofia', durationMinutes: 45, askModel: async (p) => { prompt = p; return '{}'; } });
  const catalogText = prompt.match(/Candidatos: (\[.*\])/)[1];
  const catalog = JSON.parse(catalogText);
  expect(catalog.length).toBeGreaterThan(0);
  expect(catalog.length).toBeLessThanOrEqual(24);
  expect(catalog.every((c) => c.primaryGroup === 'pernas')).toBe(true);
  expect(Object.keys(catalog[0]).sort()).toEqual(['difficulty', 'equipment', 'id', 'isCompound', 'movementPattern', 'name', 'primaryGroup', 'subgroups']);
  expect(catalogText).not.toMatch(/Rosca|Remada|Supino|machineImage|description|fs_|texto longo/);
  expect(catalogPayload(LIB)[0]).not.toHaveProperty('ref');
});

test.each([
  ['IA devolve braço e costas para pedido de perna', ['rosca_alternada_maquina', 'remada_articulada', 'supino_maquina', 'triceps_maquina', 'abdominal_maquina']],
  ['IA inventa IDs fora da biblioteca', ['agachamento_bulgaro', 'leg_curl_inventado', 'stiff_com_barra', 'x', 'y']],
  ['IA devolve ficha de perna sem nenhum exercício de perna', []],
  ['IA repete o mesmo exercício', ['leg_press', 'leg_press', 'leg_press', 'leg_press', 'leg_press']]
])('%s: cai na montagem local válida', async (_label, ids) => {
  const askModel = async () => JSON.stringify({ exercises: ids.map((id) => ({ id, sets: 3, reps: '10', rest: 60 })) });
  const spec = parseRequest('treino de perna');
  const plan = await generatePlan({ spec, library: LIB, total: 5, goal: 'Hipertrofia', durationMinutes: 45, askModel });
  expect(plan.source).toBe('local');
  expect(plan.reason).toBe('ia_invalida');
  expect(allInLib(plan)).toBe(true);
  expect(group(plan, 'pernas')).toBe(5);
  expect(checkComposition(plan.exercises, spec, 5).ok).toBe(true);
});

test('IA com composição errada (só quadríceps num pedido de pernas completas) é recusada', async () => {
  const ids = ['hack_squat', 'leg_press', 'agachamento_com_halteres', 'afundo_livre_com_halteres', 'cadeira_extensora'];
  const plan = await generatePlan({ spec: parseRequest('perna'), library: LIB, total: 5, goal: 'Hipertrofia', durationMinutes: 45, askModel: async () => JSON.stringify({ exercises: ids.map((id) => ({ id })) }) });
  expect(plan.source).toBe('local');
  expect(plan.reasons).toEqual(expect.arrayContaining(['sem_posterior_ou_gluteos']));
});

test('IA fora do ar, lenta ou com lixo: ficha válida sem IA', async () => {
  for (const askModel of [async () => { throw new Error('NVIDIA 502'); }, async () => 'isto não é json', async () => null]) {
    const plan = await generatePlan({ spec: parseRequest('quadríceps'), library: LIB, total: 6, goal: 'Hipertrofia', durationMinutes: 60, askModel });
    expect(plan.source).toBe('local');
    expect(group(plan, 'pernas')).toBe(6);
    expect(allInLib(plan)).toBe(true);
  }
});

test('pedido misto: IA sem a divisão pedida é recusada', async () => {
  const onlyLegs = ['hack_squat', 'mesa_flexora', 'hip_thrust_maquina', 'cadeira_extensora', 'panturrilha_sentado_maquina', 'leg_press'];
  const plan = await generatePlan({ spec: parseRequest('pernas + ombros'), library: LIB, total: 6, goal: 'Hipertrofia', durationMinutes: 60, askModel: async () => JSON.stringify({ exercises: onlyLegs.map((id) => ({ id })) }) });
  expect(plan.source).toBe('local');
  expect(plan.division).toBe('4 de pernas e 2 de ombros');
});

test('sem exercícios suficientes: erro claro em vez de ficha de outro grupo', async () => {
  const poor = normalizeLibrary([L('Hack Squat', 'pernas'), ...FIX.filter((f) => f.muscleGroup !== 'pernas' && f.muscleGroup !== 'perna')]);
  await expect(generatePlan({ spec: parseRequest('perna'), library: poor, total: 5, goal: 'Hipertrofia', durationMinutes: 45, askModel: async () => '{}' })).rejects.toBeInstanceOf(InsufficientExercisesError);
  expect(() => composeLocalPlan({ spec: parseRequest('perna'), library: poor, total: 5, goal: 'Hipertrofia' })).toThrow(/poucos exercícios/);
  const none = normalizeLibrary(FIX.filter((f) => !/perna/.test(f.muscleGroup)));
  expect(() => composeLocalPlan({ spec: parseRequest('panturrilhas'), library: none, total: 5, goal: 'Hipertrofia' })).toThrow(InsufficientExercisesError);
});

test('poucos mas suficientes (3): ficha menor e ainda só de pernas', () => {
  const few = normalizeLibrary([L('Hack Squat', 'pernas'), L('Mesa Flexora', 'pernas'), L('Cadeira Extensora', 'pernas'), L('Rosca Alternada Máquina', 'braços')]);
  const plan = composeLocalPlan({ spec: parseRequest('perna'), library: few, total: 6, goal: 'Hipertrofia' });
  expect(plan.exercises).toHaveLength(3);
  expect(group(plan, 'pernas')).toBe(3);
});

test('modelos oficiais: 4 de pernas, só com exercícios da biblioteca e dentro das regras de composição', () => {
  expect(templates.map((t) => t.name)).toEqual(['Pernas A — foco em quadríceps', 'Pernas B — foco em posterior e glúteos', 'Pernas C — foco em glúteos e estabilidade', 'Pernas completas']);
  const all = normalizeLibrary([...FIX, ...defaults]);
  templates.forEach((t) => {
    expect(t.scope).toBe('official');
    expect(t.exercises.length).toBeLessThanOrEqual(20);
    const picks = t.exercises.map((e) => all.find((l) => l.name === e.name));
    expect(picks.every(Boolean)).toBe(true);                                    // todo exercício existe na biblioteca
    expect(new Set(picks.map((p) => p.id)).size).toBe(picks.length);            // sem repetidos
    const spec = specFromFocus({ quadriceps: 'Quadríceps', posterior: 'Posterior e Glúteos', gluteos: 'Glúteos', completo: 'Pernas Completo' }[t.focus]);
    const check = checkComposition(picks, spec, picks.length);
    expect(check.reasons).toEqual([]);
  });
  const completa = templates.find((t) => t.focus === 'completo').exercises.map((e) => all.find((l) => l.name === e.name).primarySub);
  expect(new Set(completa)).toEqual(new Set(['quadriceps', 'posterior', 'gluteos', 'adutores', 'panturrilhas']));
});
