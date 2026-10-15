jest.mock('../firebase/config', () => ({ auth: { currentUser: null }, db: {} }));
import { AcademyApiError, academyApiMessage, createAcademyApi } from './academyApi';

const ok = (data) => new Response(JSON.stringify({ ok: true, data, requestId: 'r' }));
const err = (status, code) => new Response(JSON.stringify({ ok: false, error: { code, message: 'x' }, requestId: 'rq' }), { status });
const make = (fetchImpl, getToken = async () => 'tok') => createAcademyApi({ baseUrl: 'https://api.test', getToken, fetchImpl });

describe('createAcademyApi', () => {
  test('envia o token e devolve data; o uid nunca vai no corpo nem na URL', async () => {
    const seen = [];
    const api = make(async (url, init) => { seen.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body }); return ok({ academies: [] }); });
    await api.academies(); await api.myAssignments(); await api.training('acad1'); await api.consent('acad1');
    expect(seen.map((s) => `${s.method} ${s.url.replace('https://api.test', '')}`)).toEqual(['GET /v1/academies', 'GET /v1/me/coach-assignments', 'GET /v1/me/academies/acad1/training', 'GET /v1/me/academies/acad1/consent']);
    expect(seen.every((s) => s.auth === 'Bearer tok' && s.body === undefined)).toBe(true);
  });

  test('o código do convite vai no corpo, nunca na URL', async () => {
    const seen = [];
    const api = make(async (url, init) => { seen.push({ url, body: init.body }); return ok({}); });
    await api.previewInvite('abc'); await api.acceptInvite('abc');
    expect(seen).toEqual([{ url: 'https://api.test/v1/invites/preview', body: '{"code":"abc"}' }, { url: 'https://api.test/v1/invites/accept', body: '{"code":"abc"}' }]);
  });

  test('aceitar, recusar e encerrar professor; consentimento; sair', async () => {
    const seen = [];
    const api = make(async (url, init) => { seen.push(`${init.method} ${url.replace('https://api.test', '')} ${init.body || ''}`); return ok({}); });
    await api.acceptAssignment('a/1'); await api.rejectAssignment('a1'); await api.revokeAssignment('a1'); await api.setConsent('x1', true); await api.leave('x1'); await api.leaveAll();
    expect(seen).toEqual([
      'POST /v1/coach-assignments/a%2F1/accept {}', 'POST /v1/coach-assignments/a1/reject {}', 'POST /v1/coach-assignments/a1/revoke {}',
      'PUT /v1/me/academies/x1/consent {"shareAdherence":true}', 'POST /v1/me/academies/x1/leave {}', 'POST /v1/me/leave-all {}'
    ]);
  });

  test('erro da API vira AcademyApiError com código e status; rede cai em "network"; resposta sem JSON também falha', async () => {
    await expect(make(async () => err(404, 'invite_invalid')).previewInvite('x')).rejects.toMatchObject({ code: 'invite_invalid', status: 404, requestId: 'rq' });
    await expect(make(async () => { throw new Error('off'); }).academies()).rejects.toMatchObject({ code: 'network', status: 0 });
    await expect(make(async () => new Response('<html>', { status: 502 })).academies()).rejects.toBeInstanceOf(AcademyApiError);
  });

  test('401 renova o token uma vez e repete; se continuar 401, falha sem loop', async () => {
    const forced = [];
    const api = make(async (url, init) => (init.headers.Authorization === 'Bearer novo' ? ok({ ok: 1 }) : err(401, 'invalid_token')), async (force) => { forced.push(force); return force ? 'novo' : 'velho'; });
    expect(await api.academies()).toEqual({ ok: 1 });
    expect(forced).toEqual([false, true]);
    let calls = 0;
    const b = make(async () => { calls += 1; return err(401, 'invalid_token'); });
    await expect(b.academies()).rejects.toMatchObject({ code: 'invalid_token' });
    expect(calls).toBe(2);
  });

  test('mensagens amigáveis; erro desconhecido recebe texto padrão', () => {
    expect(academyApiMessage({ code: 'invite_invalid' })).toMatch(/inválido/);
    expect(academyApiMessage({ code: 'network' })).toMatch(/Sem conexão/);
    expect(academyApiMessage({ code: 'zzz' })).toMatch(/Não foi possível/);
  });
});
