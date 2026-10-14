// Espelho da matriz de papéis só para MOSTRAR ou esconder botões. Quem decide é o servidor (e o banco); isto nunca autoriza nada.
import { ADMIN_MANAGES, INVITE_ROLES, ROLES } from '../../../shared/academy-contracts/index.js';

export { INVITE_ROLES };

export function memberActions(me, target) {
  const none = { suspend: false, reactivate: false, remove: false, roles: [] };
  if (!me || target.userId === me.userId || !['owner', 'admin'].includes(me.role) || target.role === 'owner') return none;
  if (me.role === 'admin' && !ADMIN_MANAGES.includes(target.role)) return none;
  const removed = target.status === 'removed';
  return {
    suspend: target.status === 'active',
    reactivate: target.status === 'suspended' || (removed && me.role === 'owner'),
    remove: !removed,
    roles: removed ? [] : (me.role === 'owner' ? ROLES.filter((r) => r !== 'owner') : ADMIN_MANAGES).filter((r) => r !== target.role)
  };
}

// O que cada papel enxerga no menu (o servidor continua sendo a barreira).
export const NAV_BY_ROLE = {
  owner: ['dashboard', 'membros', 'convites', 'auditoria', 'academia'],
  admin: ['dashboard', 'membros', 'convites', 'auditoria', 'academia'],
  reception: ['dashboard', 'membros', 'convites'],
  coach: ['alunos'],
  student: []
};

export const canAssignCoach = (role) => ['owner', 'admin'].includes(role);

// Só caminho interno vira destino pós-login (nunca URL externa).
export const safeNext = (value) => (typeof value === 'string' && /^\/(?!\/)[A-Za-z0-9/_?=&.%-]*$/.test(value) ? value : '/app');
