import { describe, expect, test, vi } from 'vitest';
import { ApiRequestError, createApi, friendlyError, newIdempotencyKey } from './api';

const ok = (data) => new Response(JSON.stringify({ ok: true, data, requestId: 'r' }));
const fail = (status, code) => new Response(JSON.stringify({ ok: false, error: { code, message: 'x' }, requestId: 'req-1' }), { status });
const api = (fetchImpl, extra = {}) => createApi({ baseUrl: 'https://api.test', getToken: async () => 'tok', fetchImpl, ...extra });

describe('createApi', () => {
  test('envia o token e devolve data', async () => {
    let seen;
    const a = api(async (url, init) => { seen = { url, auth: init.headers.Authorization, method: init.method }; return ok({ uid: 'u' }); });
    expect(await a.me()).toEqual({ uid: 'u' });
    expect(seen).toEqual({ url: 'https://api.test/v1/me', auth: 'Bearer tok', method: 'GET' });
  });

  test('erro da API vira ApiRequestError com código, status e requestId', async () => {
    await expect(api(async () => fail(403, 'forbidden_role')).members('abc')).rejects.toMatchObject({ code: 'forbidden_role', status: 403, requestId: 'req-1' });
  });

  test('falha de rede e corpo inesperado', async () => {
    await expect(api(async () => { throw new Error('off'); }).me()).rejects.toMatchObject({ code: 'network', status: 0 });
    await expect(api(async () => new Response('<html>', { status: 502 })).me()).rejects.toBeInstanceOf(ApiRequestError);
  });

  test('sessão expirada: renova o token uma vez e repete; se continuar 401, avisa o app e não repete mais', async () => {
    const tokens = [];
    const onSessionExpired = vi.fn();
    const calls = [];
    const a = createApi({
      baseUrl: 'https://api.test', onSessionExpired,
      getToken: async (force) => { tokens.push(force); return force ? 'novo' : 'velho'; },
      fetchImpl: async (url, init) => { calls.push(init.headers.Authorization); return init.headers.Authorization === 'Bearer novo' ? ok({ uid: 'u' }) : fail(401, 'invalid_token'); }
    });
    expect(await a.me()).toEqual({ uid: 'u' });
    expect(calls).toEqual(['Bearer velho', 'Bearer novo']);
    expect(onSessionExpired).not.toHaveBeenCalled();
    const b = createApi({ baseUrl: 'https://api.test', onSessionExpired, getToken: async () => 'x', fetchImpl: async () => fail(401, 'invalid_token') });
    await expect(b.me()).rejects.toMatchObject({ code: 'invalid_token' });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual([false, true]);
  });

  test('o código do convite vai no corpo e nunca na URL', async () => {
    const seen = [];
    const a = api(async (url, init) => { seen.push({ url, body: init.body }); return ok({}); });
    await a.previewInvite('abc123'); await a.acceptInvite('abc123');
    expect(seen).toEqual([{ url: 'https://api.test/v1/invites/preview', body: '{"code":"abc123"}' }, { url: 'https://api.test/v1/invites/accept', body: '{"code":"abc123"}' }]);
  });

  test('operações repetíveis levam a Idempotency-Key; ids e filtros são codificados na URL', async () => {
    const seen = [];
    const a = api(async (url, init) => { seen.push({ url, key: init.headers['Idempotency-Key'], body: init.body }); return ok({}); });
    await a.createAcademy('Minha', 'k-1');
    await a.createInvite('a/b', { role: 'student' }, 'k-2');
    await a.members('x', { role: 'coach', q: 'ana silva', page: 2, status: '' });
    expect(seen[0]).toEqual({ url: 'https://api.test/v1/academies', key: 'k-1', body: '{"name":"Minha"}' });
    expect(seen[1].url).toBe('https://api.test/v1/academies/a%2Fb/invites');
    expect(seen[2].url).toBe('https://api.test/v1/academies/x/members?role=coach&q=ana+silva&page=2');
  });

  test('chaves de idempotência são únicas', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
    expect(newIdempotencyKey().length).toBeGreaterThanOrEqual(8);
  });
});

test('mensagens amigáveis por código e padrão para desconhecidos', () => {
  expect(friendlyError({ code: 'academy_unavailable' })).toMatch(/indisponível/);
  expect(friendlyError({ code: 'invite_invalid' })).toMatch(/inválido/);
  expect(friendlyError({ code: 'xyz' })).toMatch(/Algo deu errado/);
});
