// Leitura do Firestore pela API REST usando o PRÓPRIO ID token do usuário: as regras de segurança continuam valendo,
// então este Worker não precisa (e nesta fase não tem) service account. Nunca monta caminho a partir de entrada livre:
// os ids são validados antes (ID_RE) e as coleções são fixas.
import { ApiError } from './contracts.js';

export const ID_RE = /^[A-Za-z0-9_]{1,64}$/;

const decode = (v) => {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
};
const decodeFields = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
const decodeDoc = (doc) => ({ id: doc.name.split('/').pop(), ...decodeFields(doc.fields || {}) });

export function firestoreClient({ projectId, idToken, fetchImpl = fetch }) {
  const root = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };

  // Documento ou null (inexistente OU negado pelas regras: para este Worker os dois significam "sem acesso").
  async function getDoc(collection, id) {
    if (!ID_RE.test(id)) throw new ApiError('invalid_request');
    let res;
    try { res = await fetchImpl(`${root}/${collection}/${id}`, { headers }); } catch { throw new ApiError('upstream_error'); }
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) throw new ApiError('upstream_error');
    return decodeDoc(await res.json());
  }

  // Consulta de igualdade em um campo (as regras exigem o filtro por academyId ou userId).
  async function queryEquals(collection, field, value, limit = 100) {
    let res;
    try {
      res = await fetchImpl(`${root}:runQuery`, {
        method: 'POST', headers,
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit } })
      });
    } catch { throw new ApiError('upstream_error'); }
    if (res.status === 403) return null;   // negado pelas regras
    if (!res.ok) throw new ApiError('upstream_error');
    return (await res.json()).filter((row) => row.document).map((row) => decodeDoc(row.document));
  }

  return { getDoc, queryEquals };
}
