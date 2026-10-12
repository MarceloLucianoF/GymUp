import { cachedLoad, clearTtlCache } from './ttlCache';

describe('ttlCache', () => {
  beforeEach(() => clearTtlCache());

  it('reaproveita dentro do prazo e recarrega depois dele', async () => {
    const loader = jest.fn().mockResolvedValue(1);
    await cachedLoad('k', loader, { now: 0 });
    await cachedLoad('k', loader, { now: 1000 });
    expect(loader).toHaveBeenCalledTimes(1);
    await cachedLoad('k', loader, { now: 3 * 60 * 1000 + 1 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('force ignora o cache e chaves diferentes não se misturam', async () => {
    const loader = jest.fn().mockResolvedValue(1);
    await cachedLoad('a', loader, { now: 0 });
    await cachedLoad('a', loader, { now: 1, force: true });
    await cachedLoad('b', loader, { now: 1 });
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('não guarda falhas e limpa por prefixo', async () => {
    await expect(cachedLoad('x:1', () => Promise.reject(new Error('f')), { now: 0 })).rejects.toThrow('f');
    const ok = jest.fn().mockResolvedValue('v');
    await expect(cachedLoad('x:1', ok, { now: 1 })).resolves.toBe('v');
    clearTtlCache('x:');
    await cachedLoad('x:1', ok, { now: 2 });
    expect(ok).toHaveBeenCalledTimes(2);
  });
});
