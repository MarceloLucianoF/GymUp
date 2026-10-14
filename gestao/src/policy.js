// Espelho da matriz de papéis só para MOSTRAR ou esconder botões. Quem decide é o servidor (e o banco); isto nunca autoriza nada.
const LOW = ['teacher', 'reception', 'student'];
export const INVITE_ROLES = { owner: ['admin', 'teacher', 'reception', 'student'], admin: ['teacher', 'reception', 'student'], reception: ['student'] };

export function memberActions(me, target) {
  if (!me || target.userId === me.userId || !['owner', 'admin'].includes(me.role)) return { suspend: false, reactivate: false, remove: false, roles: [] };
  const manageable = me.role === 'owner' || LOW.includes(target.role);
  if (!manageable || target.status === 'left') return { suspend: false, reactivate: false, remove: false, roles: [] };
  const removed = target.status === 'removed';
  return {
    suspend: target.status === 'active',
    reactivate: target.status === 'suspended' || (removed && me.role === 'owner'),
    remove: target.status !== 'removed',
    roles: removed ? [] : (me.role === 'owner' ? ['owner', 'admin', 'teacher', 'reception', 'student'] : LOW).filter((r) => r !== target.role)
  };
}

export const safeNext = (value) => (typeof value === 'string' && /^\/(?!\/)[A-Za-z0-9/_?=&.-]*$/.test(value) ? value : '/');
