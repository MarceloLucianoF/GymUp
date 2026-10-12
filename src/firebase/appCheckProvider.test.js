import { withTokenTimeout } from './appCheckProvider';

describe('withTokenTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('repassa o token quando o provedor responde a tempo', async () => {
    const base = { initialize: jest.fn(), getToken: jest.fn().mockResolvedValue({ token: 't', expireTimeMillis: 1 }) };
    const wrapped = withTokenTimeout(base, 1000);
    wrapped.initialize('app');
    expect(base.initialize).toHaveBeenCalledWith('app');
    await expect(wrapped.getToken()).resolves.toEqual({ token: 't', expireTimeMillis: 1 });
  });

  it('script bloqueado (promessa que nunca resolve): rejeita no prazo em vez de travar', async () => {
    const base = { initialize: jest.fn(), getToken: () => new Promise(() => {}) };
    const pending = withTokenTimeout(base, 1000).getToken();
    const assertion = expect(pending).rejects.toThrow('app-check/token-timeout');
    jest.advanceTimersByTime(1001);
    await assertion;
  });

  it('erro do provedor passa adiante', async () => {
    const base = { initialize: jest.fn(), getToken: () => Promise.reject(new Error('falhou')) };
    await expect(withTokenTimeout(base, 1000).getToken()).rejects.toThrow('falhou');
  });

  it('depois de estourar o prazo, as chamadas seguintes falham na hora até o fim da pausa', async () => {
    let clock = 0;
    const base = { initialize: jest.fn(), getToken: jest.fn(() => new Promise(() => {})) };
    const wrapped = withTokenTimeout(base, 1000, 60000, () => clock);
    const first = expect(wrapped.getToken()).rejects.toThrow('app-check/token-timeout');
    jest.advanceTimersByTime(1001);
    await first;
    clock = 1001;
    await expect(wrapped.getToken()).rejects.toThrow('app-check/token-unavailable');
    expect(base.getToken).toHaveBeenCalledTimes(1);
    clock = 62000;                                                // pausa acabou: tenta de novo
    const retry = expect(wrapped.getToken()).rejects.toThrow('app-check/token-timeout');
    jest.advanceTimersByTime(1001);
    await retry;
    expect(base.getToken).toHaveBeenCalledTimes(2);
  });
});
