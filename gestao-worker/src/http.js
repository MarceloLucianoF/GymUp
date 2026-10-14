// Respostas e leitura de corpo. Toda resposta carrega requestId; erros nunca trazem detalhes internos.
import { ERRORS, LIMITS, parse } from '../../shared/academy-contracts/index.js';

export class ApiError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const BASE_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export const okResponse = (data, requestId, headers = {}) =>
  new Response(JSON.stringify({ ok: true, data, requestId }), { status: 200, headers: { ...BASE_HEADERS, ...headers } });

export const errorResponse = (code, requestId, headers = {}) => {
  const [status, message] = ERRORS[code] || ERRORS.upstream_error;
  const extra = code === 'rate_limited' ? { 'Retry-After': '60' } : {};
  return new Response(JSON.stringify({ ok: false, error: { code, message }, requestId }), { status, headers: { ...BASE_HEADERS, ...extra, ...headers } });
};

/** Lê o corpo JSON e valida com o esquema fechado: campo desconhecido (role, userId, academyId, actorUid, createdBy...) é erro. */
export async function readBody(request, schema) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > LIMITS.bodyBytes) throw new ApiError('payload_too_large');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > LIMITS.bodyBytes) throw new ApiError('payload_too_large');
  let json;
  try { json = raw.trim() === '' ? {} : JSON.parse(raw); } catch { throw new ApiError('invalid_request'); }
  const result = parse(schema, json);
  if (!result.ok) throw new ApiError('invalid_request');
  return result.value;
}

/** Inteiro de query string dentro de [min, max]; ausente vira o padrão; inválido é erro (nunca um valor "corrigido"). */
export function intParam(url, name, def, min, max) {
  const raw = url.searchParams.get(name);
  if (raw === null) return def;
  if (!/^\d{1,9}$/.test(raw)) throw new ApiError('invalid_request');
  const n = Number(raw);
  if (n < min || n > max) throw new ApiError('invalid_request');
  return n;
}

export function enumParam(url, name, allowed) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return null;
  if (!allowed.includes(raw)) throw new ApiError('invalid_request');
  return raw;
}
