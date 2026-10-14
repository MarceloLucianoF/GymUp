import { describe, expect, test } from 'vitest';
import { ApiRequestError, createApi, friendlyError, MANAGEMENT_ROLES } from './api';

const json = (status, body) => async () => new Response(JSON.stringify(body), { status });
const api = (fetchImpl) => createApi({ baseUrl: 'https://api.test', getToken: async () => 'tok', fetchImpl });

describe('createApi', () => {
  test('envia o token e devolve data', async () => {
    let seen;
    const a = api(async (url, init) => { seen = { url, auth: init.headers.Authorization }; return new Response(JSON.stringify({ ok: true, data: { uid: 'u' }, requestId: 'r' })); });
    expect(await a.me()).toEqual({ uid: 'u' });
    expect(seen).toEqual({ url: 'https://api.test/v1/me', auth: 'Bearer tok' });
  });

  test('erro da API vira ApiRequestError com código e requestId', async () => {
    const a = api(json(403, { ok: false, error: { code: 'forbidden_role', message: 'x' }, requestId: 'req-1' }));
    await expect(a.members('abc')).rejects.toMatchObject({ code: 'forbidden_role', status: 403, requestId: 'req-1' });
  });

  test('falha de rede e corpo inesperado', async () => {
    await expect(api(async () => { throw new Error('off'); }).me()).rejects.toMatchObject({ code: 'network' });
    await expect(api(async () => new Response('<html>', { status: 502 })).me()).rejects.toBeInstanceOf(ApiRequestError);
  });

  test('criar academia envia o corpo e a chave de idempotência', async () => {
    let seen;
    await api(async (url, init) => { seen = { url, method: init.method, key: init.headers['Idempotency-Key'], body: init.body }; return new Response(JSON.stringify({ ok: true, data: { academyId: 'x' }, requestId: 'r' })); }).createAcademy('Minha', 'chave-123456');
    expect(seen).toEqual({ url: 'https://api.test/v1/academies', method: 'POST', key: 'chave-123456', body: '{"name":"Minha"}' });
  });

  test('o id da academia é codificado na URL', async () => {
    let url;
    await api(async (u) => { url = u; return new Response(JSON.stringify({ ok: true, data: {}, requestId: 'r' })); }).academy('a/b');
    expect(url).toBe('https://api.test/v1/academies/a%2Fb');
  });
});

describe('mensagens e papéis', () => {
  test('mensagem amigável por código e padrão para desconhecidos', () => {
    expect(friendlyError({ code: 'academy_unavailable' })).toMatch(/indisponível/);
    expect(friendlyError({ code: 'xyz' })).toMatch(/Algo deu errado/);
    expect(friendlyError({ code: 'limit_reached' })).toMatch(/máximo/);
  });
  test('aluno não entra na Gestão', () => {
    expect(MANAGEMENT_ROLES).not.toContain('student');
  });
});
