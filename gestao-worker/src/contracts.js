// Contratos de resposta e erro da API da Gestão. Toda resposta carrega requestId; erros nunca trazem detalhes internos.

export const ROLES = ['owner', 'admin', 'teacher', 'reception', 'student'];
export const STAFF_ROLES = ['owner', 'admin'];

export const ERRORS = {
  invalid_request: [400, 'Requisição inválida.'],
  no_token: [401, 'Autenticação obrigatória.'],
  invalid_token: [401, 'Sessão inválida ou expirada.'],
  origin_not_allowed: [403, 'Origem não autorizada.'],
  no_membership: [403, 'Você não tem vínculo com esta academia.'],
  membership_inactive: [403, 'Seu vínculo com esta academia não está ativo.'],
  academy_unavailable: [403, 'Esta academia está indisponível.'],
  forbidden_role: [403, 'Seu papel não permite esta operação.'],
  not_found: [404, 'Recurso não encontrado.'],
  method_not_allowed: [405, 'Método não permitido.'],
  conflict: [409, 'Conflito com o estado atual.'],
  rate_limited: [429, 'Limite temporário de solicitações excedido.'],
  upstream_error: [502, 'Não foi possível consultar o banco de dados.'],
  ops_disabled: [503, 'Operações administrativas desativadas temporariamente.']
};

export class ApiError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    this.extra = extra;
  }
}

const BASE_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export const okResponse = (data, requestId, headers = {}) =>
  new Response(JSON.stringify({ ok: true, data, requestId }), { status: 200, headers: { ...BASE_HEADERS, ...headers } });

export const errorResponse = (code, requestId, headers = {}) => {
  const [status, message] = ERRORS[code] || ERRORS.upstream_error;
  const extra = code === 'rate_limited' ? { 'Retry-After': '60' } : {};
  return new Response(JSON.stringify({ ok: false, error: { code, message }, requestId }), { status, headers: { ...BASE_HEADERS, ...extra, ...headers } });
};
