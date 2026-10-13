// Chat com a NVIDIA como principal: pedido de ficha é respondido pelo compositor, sem depender do Gemini.
jest.mock('firebase/ai', () => ({
  getAI: jest.fn(), getGenerativeModel: jest.fn(), GoogleAIBackend: jest.fn(),
  Schema: { object: jest.fn(), number: jest.fn(), string: jest.fn(), array: jest.fn(), boolean: jest.fn(), enumString: jest.fn(), integer: jest.fn() },
}));
jest.mock('../firebase/config', () => ({ auth: { currentUser: { getIdToken: async () => 't' } }, app: {}, db: {} }));

describe('askAICoach: pedido de ficha com NVIDIA principal', () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; delete global.fetch; });

  const load = () => {
    process.env.REACT_APP_NVIDIA_PROXY = 'true';
    process.env.REACT_APP_AI_PRIMARY = 'nvidia';
    let mod;
    jest.isolateModules(() => { mod = require('./aiService'); });
    return mod.aiService;
  };

  test('com o proxy fora, devolve a ficha de pernas montada localmente e chama onWorkout', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 502, json: async () => ({}), text: async () => '' }));
    const ai = load();
    const onWorkout = jest.fn();
    const reply = await ai.askAICoach({ prompt: 'Monte um treino de perna para mim', userProfile: { goal: 'Hipertrofia' }, onWorkout });
    expect(onWorkout).toHaveBeenCalledTimes(1);
    const w = onWorkout.mock.calls[0][0];
    expect(w.exercises.length).toBeGreaterThanOrEqual(5);
    expect(w.composition.source).toBe('local');
    expect(reply).toMatch(/Montei a ficha/);
    for (const ex of w.exercises) expect(reply).toContain(ex.name);
  });
});
