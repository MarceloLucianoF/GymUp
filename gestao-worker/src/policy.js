// Matriz de papéis da gestão (docs/GESTAO_ARQUITETURA.md, seção 4). Funções puras: o Worker decide aqui, o banco é a segunda barreira.

// Que papéis cada função pode convidar. Admin não cria admin; recepção só convida aluno.
export const INVITE_ROLES = {
  owner: ['admin', 'teacher', 'reception', 'student'],
  admin: ['teacher', 'reception', 'student'],
  reception: ['student']
};
export const INVITE_ACTORS = Object.keys(INVITE_ROLES);

const LOW_ROLES = ['teacher', 'reception', 'student'];
const SETTABLE_STATUS = ['active', 'suspended', 'removed'];

/**
 * Pode `actor` aplicar `change` ({role?, status?}) ao membro `target`? Devolve true ou um motivo.
 * Dono mexe em qualquer outro membro; admin só em professor, recepção e aluno, sem promover a admin ou dono;
 * ninguém altera o próprio vínculo por aqui (sair é outro endpoint); 'left' só o próprio membro (por convite/saída).
 */
export function canChangeMember(actor, target, change) {
  if (actor.userId === target.user_id) return 'self';
  if (!['owner', 'admin'].includes(actor.role)) return 'role';
  if (change.role === undefined && change.status === undefined) return 'empty';
  if (change.status !== undefined && !SETTABLE_STATUS.includes(change.status)) return 'status';
  if (actor.role === 'admin') {
    if (!LOW_ROLES.includes(target.role)) return 'role';
    if (change.role !== undefined && !LOW_ROLES.includes(change.role)) return 'role';
  }
  if (target.status === 'left') return 'left';
  if (target.status === 'removed' && change.status === 'active' && actor.role !== 'owner') return 'role';   // só o dono reativa removido
  if (target.status === 'removed' && change.status === undefined) return 'removed';
  return true;
}

export const ROLE_VALUES = ['owner', 'admin', 'teacher', 'reception', 'student'];
