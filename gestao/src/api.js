// Cliente da API da Gestão. Sempre envia o ID token do usuário; o servidor decide papel e academia (nada daqui é autoridade).
export class ApiRequestError extends Error {
  constructor(code, status, requestId, message) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export function createApi({ baseUrl, getToken, fetchImpl = fetch }) {
  async function request(path, { method = 'GET', body, idempotencyKey } = {}) {
    const token = await getToken();
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new ApiRequestError('network', 0, null, 'Sem conexão com o servidor.');
    }
    let json = null;
    try { json = await res.json(); } catch { /* corpo não é JSON */ }
    if (!json || json.ok !== true) {
      const err = json?.error;
      throw new ApiRequestError(err?.code || 'unknown', res.status, json?.requestId || null, err?.message);
    }
    return json.data;
  }
  return {
    me: () => request('/v1/me'),
    academy: (id) => request(`/v1/academies/${encodeURIComponent(id)}`),
    members: (id) => request(`/v1/academies/${encodeURIComponent(id)}/members`)
  };
}

const MESSAGES = {
  network: 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.',
  no_token: 'Entre novamente para continuar.',
  invalid_token: 'Sua sessão expirou. Entre novamente.',
  no_membership: 'Você não tem vínculo com esta academia.',
  membership_inactive: 'Seu vínculo com esta academia não está ativo.',
  academy_unavailable: 'Esta academia está indisponível no momento.',
  forbidden_role: 'Seu papel não permite abrir esta área.',
  rate_limited: 'Muitas solicitações seguidas. Aguarde um minuto.',
  ops_disabled: 'As operações administrativas estão pausadas.',
  upstream_error: 'O servidor não conseguiu consultar os dados. Tente novamente.'
};
export const friendlyError = (err) => MESSAGES[err?.code] || 'Algo deu errado. Tente novamente.';

export const ROLE_LABELS = { owner: 'Proprietário', admin: 'Administrador', teacher: 'Professor', reception: 'Recepção', student: 'Aluno' };
// Quem entra na Gestão: o aluno usa o app do aluno.
export const MANAGEMENT_ROLES = ['owner', 'admin', 'teacher', 'reception'];
