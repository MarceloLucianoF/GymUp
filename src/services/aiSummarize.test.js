// summarizeFacts com o proxy da NVIDIA ligado (variável lida na carga do módulo).
describe('aiService.summarizeFacts', () => {
  let aiService; let fetchMock;
  const loadWith = (proxy, user = { getIdToken: async () => 'tok' }) => {
    jest.resetModules();
    process.env.REACT_APP_NVIDIA_PROXY = proxy;
    jest.doMock('../firebase/config', () => ({ auth: { currentUser: user }, app: {}, db: {} }));
    jest.doMock('firebase/firestore', () => ({}));
    ({ aiService } = require('./aiService'));
  };
  const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
  afterEach(() => { delete process.env.REACT_APP_NVIDIA_PROXY; });
  const msgs = [{ role: 'system', content: 's' }, { role: 'user', content: '{"treinos_concluidos":3}' }];

  it('chama o proxy com orçamento para modelo de raciocínio (1200 tokens) e devolve o texto', async () => {
    loadWith('true');
    fetchMock.mockReturnValue(reply({ model: 'm', choices: [{ message: { content: 'Resumo pronto.' } }] }));
    expect(await aiService.summarizeFacts(msgs)).toBe('Resumo pronto.');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/nvidia');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ max_tokens: 1200, temperature: 0.3 });
    expect(JSON.stringify(body)).not.toMatch(/@|email/i);
  });

  it.each([['429', 429], ['502', 502], ['504', 504]])('HTTP %s vira null (sem quebrar)', async (_n, status) => {
    loadWith('true');
    fetchMock.mockReturnValue(reply({}, status));
    expect(await aiService.summarizeFacts(msgs)).toBeNull();
  });

  it('resposta vazia, rede caindo e prazo estourado viram null', async () => {
    loadWith('true');
    fetchMock.mockReturnValueOnce(reply({ choices: [{ message: { content: '  ' } }] }));
    expect(await aiService.summarizeFacts(msgs)).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await aiService.summarizeFacts(msgs)).toBeNull();
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('abort'), { name: 'AbortError' }));
    expect(await aiService.summarizeFacts(msgs)).toBeNull();
  });

  it('recurso desligado ou sem sessão: nem chama o proxy', async () => {
    loadWith('false');
    expect(await aiService.summarizeFacts(msgs)).toBeNull();
    loadWith('true', null);
    expect(await aiService.summarizeFacts(msgs)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
