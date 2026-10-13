import { aiService, canonicalGroup, inferFocusFromPrompt, pickForFocus } from './aiService';

jest.mock('../firebase/config', () => ({ auth: {}, db: {}, app: {} }));

// Biblioteca parecida com a real: rótulos misturados e braço/costas antes das pernas (era o que quebrava o filtro antigo).
const lib = [
  { id: 'a1', name: 'Rosca Alternada Máquina', muscleGroup: 'braços' },
  { id: 'a2', name: 'Remada Articulada', muscleGroup: 'costas' },
  { id: 'a3', name: 'Supino Máquina', muscleGroup: 'peito' },
  { id: 'a4', name: 'Tríceps Máquina', muscleGroup: 'braços' },
  { id: 'p1', name: 'Cadeira Extensora', muscleGroup: 'pernas' },
  { id: 'p2', name: 'Hack Squat', muscleGroup: 'pernas' },
  { id: 'p3', name: 'Mesa Flexora', muscleGroup: 'perna' },
  { id: 'p4', name: 'Panturrilha Sentado Máquina', muscleGroup: 'pernas' },
  { id: 'p5', name: 'Hip Thrust Máquina', muscleGroup: 'gluteo' },
  { id: 'p6', name: 'Cadeira Abdutora', muscleGroup: 'pernas' },
  { id: 'o1', name: 'Elevação Lateral Máquina', muscleGroup: 'ombros' },
  { id: 'c1', name: 'Abdominal Máquina', muscleGroup: 'core' }
];

test('rótulos diferentes caem no mesmo grupo', () => {
  ['pernas', 'perna', 'Quadríceps', 'gluteo', 'Panturrilha'].forEach((g) => expect(canonicalGroup(g)).toBe('pernas'));
  expect(canonicalGroup('braços')).toBe('bracos');
  expect(canonicalGroup('biceps')).toBe('bracos');
  expect(canonicalGroup('ombro')).toBe('ombros');
});

test('treino de perna traz só perna, com composto na frente', () => {
  const out = pickForFocus(lib, 'Pernas Completo', 5);
  expect(out).toHaveLength(5);
  expect(out.every((e) => canonicalGroup(e.muscleGroup) === 'pernas')).toBe(true);
  expect(out[0].name).toBe('Hack Squat');
});

test('costas e bíceps não traz tríceps nem perna; peito e tríceps não traz bíceps', () => {
  const costas = pickForFocus(lib, 'Costas e Bíceps', 5).map((e) => e.name);
  expect(costas).toEqual(expect.arrayContaining(['Remada Articulada', 'Rosca Alternada Máquina']));
  expect(costas).not.toContain('Tríceps Máquina');
  const peito = pickForFocus(lib, 'Peito e Tríceps', 5).map((e) => e.name);
  expect(peito).toEqual(expect.arrayContaining(['Supino Máquina', 'Tríceps Máquina']));
  expect(peito).not.toContain('Rosca Alternada Máquina');
});

test('full body mistura grupos e não repete nome', () => {
  const out = pickForFocus([...lib, lib[0]], 'Full Body (Corpo Todo)', 6);
  expect(new Set(out.map((e) => e.name)).size).toBe(out.length);
  expect(new Set(out.map((e) => canonicalGroup(e.muscleGroup))).size).toBeGreaterThanOrEqual(4);
});

test('o que o aluno pediu manda sobre o foco escolhido pelo modelo', () => {
  expect(inferFocusFromPrompt('monte um treino de perna')).toBe('Pernas Completo');
  expect(inferFocusFromPrompt('quero treino de glúteos e coxa')).toBe('Pernas Completo');
  expect(inferFocusFromPrompt('treino de costas e bíceps')).toBe('Costas e Bíceps');
  expect(inferFocusFromPrompt('treino de peito')).toBe('Peito e Tríceps');
  expect(inferFocusFromPrompt('treino de corpo todo')).toBe('Full Body (Corpo Todo)');
  expect(inferFocusFromPrompt('monte um treino')).toBeNull();
});

test('fallback local de perna com a biblioteca real (arrays de braço e costas na frente) só devolve perna', () => {
  const w = aiService.generateLocalWorkout({ goal: 'Hipertrofia', muscleFocus: 'Pernas Completo', durationMinutes: 60, customExercises: lib });
  expect(w.exercises).toHaveLength(6);
  expect(w.exercises.every((e) => canonicalGroup(e.muscleGroup) === 'pernas')).toBe(true);
  expect(w.name).toMatch(/Pernas/);
});

// ---- gerador completo (aiService.generateAIWorkout) com a IA indisponível: a ficha precisa sair válida e só da biblioteca ----
import { InsufficientExercisesError, canonicalGroup as cg } from './aiService';
import { exercises as defaultLib } from '../data/exercises';

const LEGS = ['Hack Squat', 'Agachamento com Halteres', 'Afundo Livre com Halteres', 'Cadeira Extensora', 'Mesa Flexora', 'Cadeira Flexora', 'Hip Thrust Máquina', 'Glúteo Máquina', 'Cadeira Abdutora', 'Cadeira Adutora', 'Panturrilha Sentado Máquina', 'Panturrilha em pé com Halteres'];
const OTHERS = [['Rosca Alternada Máquina', 'braços'], ['Remada Articulada', 'costas'], ['Supino Máquina', 'peito'], ['Elevação Lateral Máquina', 'ombros'], ['Desenvolvimento Máquina', 'ombros'], ['Abdominal Máquina', 'core']];
const FULL = [...OTHERS.map(([name, muscleGroup]) => ({ name, muscleGroup })), ...LEGS.map((name) => ({ name, muscleGroup: 'pernas' }))];
const allowed = new Set([...FULL.map((e) => e.name), ...defaultLib.map((e) => e.name)]);
const grp = (w, g) => w.exercises.filter((e) => cg(e.muscleGroup) === g).length;

test.each([
  ['perna', 'monte um treino de perna', 'Pernas completas'],
  ['quadríceps', 'treino de quadríceps', 'Quadríceps'],
  ['posterior', 'treino de posterior', 'Posterior e glúteos'],
  ['glúteos', 'treino de glúteos', 'Glúteos']
])('gerador com IA fora do ar (%s): ficha válida, só de pernas e com o foco na composição', async (_n, request, label) => {
  const w = await aiService.generateAIWorkout({ goal: 'Hipertrofia', muscleFocus: 'Peito e Tríceps', durationMinutes: 60, customExercises: FULL, userRequest: request });
  expect(w.exercises).toHaveLength(6);
  expect(w.exercises.every((e) => allowed.has(e.name))).toBe(true);
  expect(grp(w, 'pernas')).toBe(6);
  expect(w.composition).toMatchObject({ focus: label, source: 'local' });
});

test('gerador: pernas + ombros informa a divisão 4 de pernas e 2 de ombros', async () => {
  const w = await aiService.generateAIWorkout({ goal: 'Hipertrofia', durationMinutes: 60, customExercises: FULL, userRequest: 'quero pernas + ombros' });
  expect(grp(w, 'pernas')).toBe(4);
  expect(grp(w, 'ombros')).toBe(2);
  expect(w.composition.division).toBe('4 de pernas e 2 de ombros');
  expect(w.description).toMatch(/Divisão: 4 de pernas e 2 de ombros/);
});

test('gerador: pedido ambíguo usa o foco escolhido na tela, nunca outro grupo', async () => {
  const w = await aiService.generateAIWorkout({ goal: 'Hipertrofia', muscleFocus: 'Quadríceps', durationMinutes: 45, customExercises: FULL, userRequest: 'um treino bem legal de agachamento' });
  expect(w.composition.focus).toBe('Quadríceps');
  expect(grp(w, 'pernas')).toBe(5);
});

test('gerador: sem exercícios suficientes do grupo, erro claro e nenhuma ficha de outro grupo', async () => {
  const noLegs = FULL.filter((e) => e.muscleGroup !== 'pernas');
  const original = defaultLib.splice(0, defaultLib.length, ...defaultLib.filter((e) => cg(e.muscleGroup) !== 'pernas'));
  try {
    await expect(aiService.generateAIWorkout({ goal: 'Hipertrofia', durationMinutes: 45, customExercises: noLegs, userRequest: 'treino de panturrilhas' })).rejects.toBeInstanceOf(InsufficientExercisesError);
  } finally { defaultLib.push(...original); }
});

test('modelos oficiais entram como referência no pedido à IA (só nome e IDs), sem imagens', async () => {
  const { generatePlan: gp, normalizeLibrary: nl, parseRequest: pr } = await import('../utils/workoutComposer');
  let prompt = '';
  await gp({ spec: pr('perna'), library: nl(FULL), total: 6, goal: 'Hipertrofia', durationMinutes: 60, references: [{ name: 'Pernas completas', exercises: ['leg_press', 'hack_squat'] }], askModel: async (p) => { prompt = p; return '{}'; } });
  expect(prompt).toMatch(/Modelos oficiais de referência/);
  expect(prompt).toMatch(/Pernas completas/);
  expect(prompt).not.toMatch(/machineImage|\/exercises\//);
});
