import * as academies from './handlers/academies.js';
import * as members from './handlers/members.js';
import * as invites from './handlers/invites.js';
import * as coaching from './handlers/coaching.js';
import * as consents from './handlers/consents.js';
import * as audit from './handlers/audit.js';
import * as training from './handlers/training.js';
import * as students from './handlers/students.js';
import * as dataRights from './handlers/dataRights.js';
import * as finance from './handlers/finance.js';

// Tabela de rotas: método, caminho e handler. Os parâmetros do caminho têm formato fechado; nenhum caminho de coleção vem do cliente.
const P = { academyId: '[A-Za-z0-9_]{1,40}', uid: '[A-Za-z0-9_-]{1,128}', id: '[A-Za-z0-9_]{1,64}', version: '[0-9]{1,6}' };
const route = (method, path, handler, opts = {}) => {
  const names = [];
  const source = path.replace(/:(\w+)/g, (_, n) => { names.push(n); return `(${P[n]})`; });
  return { method, regex: new RegExp(`^${source}$`), names, handler, ...opts };
};

export const ROUTES = [
  route('GET', '/v1/health', null, { public: true }),
  route('GET', '/v1/me', academies.me),
  route('GET', '/v1/academies', academies.listMine),
  route('POST', '/v1/academies', academies.create),
  route('GET', '/v1/academies/:academyId', academies.get),
  route('PATCH', '/v1/academies/:academyId', academies.update),
  route('GET', '/v1/academies/:academyId/profile', academies.profile),
  route('GET', '/v1/academies/:academyId/dashboard', academies.dashboard),
  route('GET', '/v1/academies/:academyId/plans', finance.listPlans),
  route('POST', '/v1/academies/:academyId/plans', finance.createPlan),
  route('PATCH', '/v1/academies/:academyId/plans/:id', finance.updatePlan),
  route('GET', '/v1/academies/:academyId/contracts', finance.listContracts),
  route('POST', '/v1/academies/:academyId/contracts', finance.createContract),
  route('PATCH', '/v1/academies/:academyId/contracts/:id', finance.updateContract),
  route('GET', '/v1/academies/:academyId/charges', finance.listCharges),
  route('POST', '/v1/academies/:academyId/charges/generate', finance.generateCharges),
  route('POST', '/v1/academies/:academyId/charges/:id/pay', finance.payCharge),
  route('POST', '/v1/academies/:academyId/charges/:id/revert', finance.revertPayment),
  route('POST', '/v1/academies/:academyId/charges/:id/cancel', finance.cancelCharge),
  route('POST', '/v1/academies/:academyId/charges/:id/exempt', finance.exemptCharge),
  route('PATCH', '/v1/academies/:academyId/charges/:id', finance.adjustCharge),
  route('GET', '/v1/academies/:academyId/finance/summary', finance.summary),
  route('GET', '/v1/academies/:academyId/finance/retention', finance.retention),
  route('POST', '/v1/academies/:academyId/finance/export', finance.exportFinance),
  route('POST', '/v1/academies/:academyId/export', dataRights.exportAcademy),
  route('POST', '/v1/academies/:academyId/close', dataRights.closeAcademy),
  route('POST', '/v1/academies/:academyId/transfer-ownership', academies.transferOwnership),
  route('GET', '/v1/academies/:academyId/members', members.list),
  route('PATCH', '/v1/academies/:academyId/members/:uid/role', members.changeRole),
  route('PATCH', '/v1/academies/:academyId/members/:uid/permissions', members.setPermissions),
  route('POST', '/v1/academies/:academyId/members/:uid/suspend', members.suspend),
  route('POST', '/v1/academies/:academyId/members/:uid/reactivate', members.reactivate),
  route('POST', '/v1/academies/:academyId/members/:uid/remove', members.remove),
  route('GET', '/v1/academies/:academyId/coach/students', members.coachStudents),
  route('GET', '/v1/academies/:academyId/coach/unassigned-students', members.unassignedStudents),
  route('POST', '/v1/academies/:academyId/invites', invites.create),
  route('GET', '/v1/academies/:academyId/invites', invites.list),
  route('POST', '/v1/academies/:academyId/invites/:id/revoke', invites.revoke),
  route('POST', '/v1/invites/preview', invites.preview),
  route('POST', '/v1/invites/accept', invites.accept),
  route('GET', '/v1/academies/:academyId/audit', audit.list),
  route('POST', '/v1/academies/:academyId/coach-assignments', coaching.propose),
  route('GET', '/v1/academies/:academyId/coach-assignments', coaching.listForAcademy),
  route('POST', '/v1/coach-assignments/:id/approve', coaching.approve),
  route('POST', '/v1/coach-assignments/:id/accept', coaching.accept),
  route('POST', '/v1/coach-assignments/:id/reject', coaching.reject),
  route('POST', '/v1/coach-assignments/:id/revoke', coaching.revoke),
  route('GET', '/v1/academies/:academyId/students', students.list),
  route('GET', '/v1/academies/:academyId/trainings', training.list),
  route('POST', '/v1/academies/:academyId/trainings', training.create),
  route('GET', '/v1/academies/:academyId/trainings/:id', training.detail),
  route('PATCH', '/v1/academies/:academyId/trainings/:id', training.update),
  route('GET', '/v1/academies/:academyId/trainings/:id/versions/:version', training.version),
  route('GET', '/v1/academies/:academyId/trainings/:id/compare', training.compare),
  route('POST', '/v1/academies/:academyId/trainings/:id/duplicate', training.duplicate),
  route('POST', '/v1/academies/:academyId/trainings/:id/archive', training.archive),
  route('POST', '/v1/academies/:academyId/trainings/:id/restore', training.restore),
  route('POST', '/v1/academies/:academyId/trainings/:id/assign-batch', training.assignBatch),
  route('POST', '/v1/academies/:academyId/trainings/:id/publish', training.publish),
  route('POST', '/v1/academies/:academyId/trainings/:id/assign', training.assign),
  // Escopo do aluno (o próprio uid, nunca outro)
  route('GET', '/v1/me/export', dataRights.exportMine, { killSwitchExempt: true }),
  route('GET', '/v1/me/coach-assignments', coaching.mine),
  route('GET', '/v1/me/academies/:academyId/consent', consents.get),
  route('PUT', '/v1/me/academies/:academyId/consent', consents.put),
  route('GET', '/v1/me/academies/:academyId/training', training.mine),
  // Sair da academia continua funcionando com o kill switch ligado (reduz acesso a dados; um incidente não pode prender o usuário).
  route('POST', '/v1/me/academies/:academyId/leave', members.leave, { killSwitchExempt: true }),
  route('POST', '/v1/me/leave-all', members.leaveAll, { killSwitchExempt: true })
];

export function match(method, pathname) {
  let pathMatched = false;
  for (const r of ROUTES) {
    const m = pathname.match(r.regex);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    return { route: r, params: Object.fromEntries(r.names.map((n, i) => [n, m[i + 1]])) };
  }
  return { route: null, pathMatched };
}
