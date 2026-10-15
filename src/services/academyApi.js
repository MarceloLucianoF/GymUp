// Cliente da API da academia (BohTreinar Gestão) para o app do aluno. O domínio da academia mora no Worker/D1; o app só pede os dados
// do PRÓPRIO usuário (o servidor deriva o uid do token). Check-ins, medidas e histórico seguem no Firestore pessoal.
import { auth } from '../firebase/config';

const BASE = (process.env.REACT_APP_ACADEMY_API || '').replace(/\/+$/, '');
export const ACADEMY_API_ENABLED = BASE !== '';
export const GESTAO_URL = (process.env.REACT_APP_GESTAO_URL || '').replace(/\/+$/, '');

export class AcademyApiError extends Error {
  constructor(code, status, requestId) { super(code); this.code = code; this.status = status; this.requestId = requestId; }
}

const MESSAGES = {
  network: 'Sem conexão com a academia. Verifique a internet e tente de novo.',
  invite_invalid: 'Este convite é inválido, expirou ou já foi usado.',
  already_member: 'Você já faz parte desta academia.',
  conflict: 'Não foi possível concluir: os dados mudaram. Atualize e tente de novo.',
  membership_inactive: 'Seu vínculo com esta academia não está ativo.',
  no_membership: 'Você não tem vínculo com esta academia.',
  academy_unavailable: 'Esta academia está indisponível no momento.',
  rate_limited: 'Muitas solicitações seguidas. Aguarde um minuto.',
  ops_disabled: 'As operações da academia estão pausadas.',
  invalid_token: 'Sua sessão expirou. Entre novamente.'
};
export const academyApiMessage = (error) => MESSAGES[error?.code] || 'Não foi possível concluir agora. Tente novamente.';

/** `getToken(force)` devolve o ID token; um 401 renova o token UMA vez e repete (sem loop). */
export function createAcademyApi({ baseUrl, getToken, fetchImpl = (...a) => fetch(...a) }) {
  async function once(path, method, body, force) {
    let token;
    try { token = await getToken(force); } catch { throw new AcademyApiError('invalid_token', 401, null); }
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch { throw new AcademyApiError('network', 0, null); }
    let json = null;
    try { json = await res.json(); } catch { /* resposta sem JSON */ }
    if (!json || json.ok !== true) throw new AcademyApiError(json?.error?.code || 'unknown', res.status, json?.requestId || null);
    return json.data;
  }
  async function request(path, method = 'GET', body) {
    try { return await once(path, method, body, false); } catch (error) {
      if (error.status !== 401) throw error;
      return once(path, method, body, true);
    }
  }
  const enc = encodeURIComponent;
  return {
    academies: () => request('/v1/academies'),
    previewInvite: (code) => request('/v1/invites/preview', 'POST', { code }),
    acceptInvite: (code) => request('/v1/invites/accept', 'POST', { code }),
    myAssignments: () => request('/v1/me/coach-assignments'),
    acceptAssignment: (id) => request(`/v1/coach-assignments/${enc(id)}/accept`, 'POST', {}),
    rejectAssignment: (id) => request(`/v1/coach-assignments/${enc(id)}/reject`, 'POST', {}),
    revokeAssignment: (id) => request(`/v1/coach-assignments/${enc(id)}/revoke`, 'POST', {}),
    consent: (academyId) => request(`/v1/me/academies/${enc(academyId)}/consent`),
    setConsent: (academyId, shareAdherence) => request(`/v1/me/academies/${enc(academyId)}/consent`, 'PUT', { shareAdherence }),
    leave: (academyId) => request(`/v1/me/academies/${enc(academyId)}/leave`, 'POST', {}),
    leaveAll: () => request('/v1/me/leave-all', 'POST', {}),
    training: (academyId) => request(`/v1/me/academies/${enc(academyId)}/training`)
  };
}

export const academyApi = createAcademyApi({
  baseUrl: BASE,
  getToken: async (force) => { if (!auth.currentUser) throw new Error('sem sessão'); return auth.currentUser.getIdToken(!!force); }
});
