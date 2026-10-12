import { cacheableProfile, readCachedProfile, writeCachedProfile, clearCachedProfile, PROFILE_CACHE_KEY } from './profileCache';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m }; };
const full = { uid: 'u1', role: 'user', displayName: 'Ana', photoURL: 'x.png', goal: 'Hipertrofia', coachId: 'c1', weight: 70, height: 170, age: 30, email: 'a@b.com', phone: '11999999999', createdAt: 'x' };

describe('cache mínimo do perfil', () => {
  it('guarda só campos de interface; nunca saúde, e-mail ou telefone', () => {
    const slim = cacheableProfile(full);
    expect(slim).toEqual({ uid: 'u1', role: 'user', displayName: 'Ana', photoURL: 'x.png', goal: 'Hipertrofia', coachId: 'c1' });
    ['weight', 'height', 'age', 'email', 'phone'].forEach((k) => expect(slim).not.toHaveProperty(k));
  });

  it('recusa perfil sem papel válido', () => {
    expect(cacheableProfile({ uid: 'u1', role: 'dono' })).toBeNull();
    expect(cacheableProfile(null)).toBeNull();
  });

  it('só devolve a cópia do mesmo usuário e limpa ao sair', () => {
    const s = memory();
    writeCachedProfile(full, s);
    expect(readCachedProfile('u1', s)).toMatchObject({ role: 'user', displayName: 'Ana' });
    expect(readCachedProfile('outro', s)).toBeNull();
    expect(s.raw.get(PROFILE_CACHE_KEY)).not.toMatch(/weight|a@b\.com|11999999999/);
    clearCachedProfile(s);
    expect(readCachedProfile('u1', s)).toBeNull();
  });

  it('conteúdo corrompido não derruba nada', () => {
    const s = memory();
    s.setItem(PROFILE_CACHE_KEY, '{nao-e-json');
    expect(readCachedProfile('u1', s)).toBeNull();
  });
});
