// Cliente da API da Gestão. Sempre envia o ID token do usuário; o servidor decide papel e academia (nada daqui é autoridade).
import { friendlyError } from '../../shared/academy-contracts/index.js';

export { friendlyError };

export class ApiRequestError extends Error {
  constructor(code, status, requestId, message) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

const q = (params) => {
  const s = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return s ? `?${s}` : '';
};
const enc = encodeURIComponent;
export const newIdempotencyKey = () => `k-${crypto.randomUUID()}`;

export function createApi({ baseUrl, getToken, onSessionExpired, fetchImpl = fetch }) {
  async function once(path, { method, body, idempotencyKey }, forceRefresh) {
    let token;
    try { token = await getToken(forceRefresh); } catch { throw new ApiRequestError('invalid_token', 401, null); }
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
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

  // Sessão expirada: tenta renovar o token UMA vez; se ainda for 401, avisa o app (que volta ao login) sem repetir a operação.
  async function request(path, opts = {}) {
    const o = { method: opts.method || 'GET', body: opts.body, idempotencyKey: opts.idempotencyKey };
    try { return await once(path, o, false); } catch (error) {
      if (error.status !== 401) throw error;
      try { return await once(path, o, true); } catch (second) {
        if (second.status === 401) onSessionExpired?.();
        throw second;
      }
    }
  }

  const A = (id) => `/v1/academies/${enc(id)}`;
  return {
    health: () => request('/v1/health'),
    me: () => request('/v1/me'),
    academies: () => request('/v1/academies'),
    createAcademy: (name, key) => request('/v1/academies', { method: 'POST', body: { name }, idempotencyKey: key }),
    academy: (id) => request(A(id)),
    profile: (id) => request(`${A(id)}/profile`),
    updateAcademy: (id, body) => request(A(id), { method: 'PATCH', body }),
    dashboard: (id) => request(`${A(id)}/dashboard`),
    plans: (id) => request(`${A(id)}/plans`),
    createPlan: (id, body) => request(`${A(id)}/plans`, { method: 'POST', body }),
    updatePlan: (id, pid, body) => request(`${A(id)}/plans/${enc(pid)}`, { method: 'PATCH', body }),
    contracts: (id, params) => request(`${A(id)}/contracts${q(params)}`),
    createContract: (id, body) => request(`${A(id)}/contracts`, { method: 'POST', body }),
    updateContract: (id, cid, body) => request(`${A(id)}/contracts/${enc(cid)}`, { method: 'PATCH', body }),
    charges: (id, params) => request(`${A(id)}/charges${q(params)}`),
    generateCharges: (id, body, key) => request(`${A(id)}/charges/generate`, { method: 'POST', body, idempotencyKey: key }),
    payCharge: (id, cid, body) => request(`${A(id)}/charges/${enc(cid)}/pay`, { method: 'POST', body }),
    chargeAction: (id, cid, action, note) => request(`${A(id)}/charges/${enc(cid)}/${action}`, { method: 'POST', body: note ? { note } : {} }),
    adjustCharge: (id, cid, body) => request(`${A(id)}/charges/${enc(cid)}`, { method: 'PATCH', body }),
    financeSummary: (id, params) => request(`${A(id)}/finance/summary${q(params)}`),
    financeRetention: (id, params) => request(`${A(id)}/finance/retention${q(params)}`),
    exportFinance: (id, body) => request(`${A(id)}/finance/export`, { method: 'POST', body }),
    exportAcademy: (id) => request(`${A(id)}/export`, { method: 'POST', body: {} }),
    closeAcademy: (id, confirmName, key) => request(`${A(id)}/close`, { method: 'POST', body: { confirmName, confirm: true }, idempotencyKey: key }),
    transferOwnership: (id, toUid, key) => request(`${A(id)}/transfer-ownership`, { method: 'POST', body: { toUid, confirm: true }, idempotencyKey: key }),
    members: (id, params) => request(`${A(id)}/members${q(params)}`),
    changeRole: (id, uid, role) => request(`${A(id)}/members/${enc(uid)}/role`, { method: 'PATCH', body: { role } }),
    setPermissions: (id, uid, canCreateTrainings) => request(`${A(id)}/members/${enc(uid)}/permissions`, { method: 'PATCH', body: { canCreateTrainings } }),
    suspend: (id, uid) => request(`${A(id)}/members/${enc(uid)}/suspend`, { method: 'POST', body: {} }),
    reactivate: (id, uid) => request(`${A(id)}/members/${enc(uid)}/reactivate`, { method: 'POST', body: {} }),
    remove: (id, uid) => request(`${A(id)}/members/${enc(uid)}/remove`, { method: 'POST', body: {} }),
    leave: (id) => request(`/v1/me/academies/${enc(id)}/leave`, { method: 'POST', body: {} }),
    coachStudents: (id) => request(`${A(id)}/coach/students`),
    unassignedStudents: (id) => request(`${A(id)}/coach/unassigned-students`),
    invites: (id, params) => request(`${A(id)}/invites${q(params)}`),
    createInvite: (id, body, key) => request(`${A(id)}/invites`, { method: 'POST', body, idempotencyKey: key }),
    revokeInvite: (id, inviteId) => request(`${A(id)}/invites/${enc(inviteId)}/revoke`, { method: 'POST', body: {} }),
    previewInvite: (code) => request('/v1/invites/preview', { method: 'POST', body: { code } }),
    acceptInvite: (code) => request('/v1/invites/accept', { method: 'POST', body: { code } }),
    audit: (id, params) => request(`${A(id)}/audit${q(params)}`),
    assignments: (id) => request(`${A(id)}/coach-assignments`),
    proposeCoach: (id, body, key) => request(`${A(id)}/coach-assignments`, { method: 'POST', body, idempotencyKey: key }),
    approveAssignment: (aid) => request(`/v1/coach-assignments/${enc(aid)}/approve`, { method: 'POST', body: {} }),
    rejectAssignment: (aid) => request(`/v1/coach-assignments/${enc(aid)}/reject`, { method: 'POST', body: {} }),
    revokeAssignment: (aid) => request(`/v1/coach-assignments/${enc(aid)}/revoke`, { method: 'POST', body: {} }),
    students: (id, params) => request(`${A(id)}/students${q(params)}`),
    trainings: (id, params) => request(`${A(id)}/trainings${q(params)}`),
    createTraining: (id, body) => request(`${A(id)}/trainings`, { method: 'POST', body }),
    training: (id, tid) => request(`${A(id)}/trainings/${enc(tid)}`),
    updateTraining: (id, tid, body) => request(`${A(id)}/trainings/${enc(tid)}`, { method: 'PATCH', body }),
    publishTraining: (id, tid) => request(`${A(id)}/trainings/${enc(tid)}/publish`, { method: 'POST', body: {} }),
    duplicateTraining: (id, tid, name) => request(`${A(id)}/trainings/${enc(tid)}/duplicate`, { method: 'POST', body: name ? { name } : {} }),
    archiveTraining: (id, tid) => request(`${A(id)}/trainings/${enc(tid)}/archive`, { method: 'POST', body: {} }),
    restoreTraining: (id, tid) => request(`${A(id)}/trainings/${enc(tid)}/restore`, { method: 'POST', body: {} }),
    trainingVersion: (id, tid, version) => request(`${A(id)}/trainings/${enc(tid)}/versions/${enc(version)}`),
    compareTraining: (id, tid, from, to) => request(`${A(id)}/trainings/${enc(tid)}/compare${q({ from, to })}`),
    assignTraining: (id, tid, body) => request(`${A(id)}/trainings/${enc(tid)}/assign`, { method: 'POST', body }),
    assignBatch: (id, tid, body, key) => request(`${A(id)}/trainings/${enc(tid)}/assign-batch`, { method: 'POST', body, idempotencyKey: key })
  };
}
