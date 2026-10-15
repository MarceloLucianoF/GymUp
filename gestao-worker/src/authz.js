// Cadeia de autorização de toda rota autenticada: token -> uid -> vínculo real no D1 -> academia ativa -> papel.
// academyId vem SEMPRE da URL e é conferido com o vínculo lido no banco; nada do corpo vale como autoridade.
import { verifyFirebaseIdToken } from '../../shared/firebaseAuth.js';
import { ADMIN_MANAGES, INVITE_ROLES, ROLES } from '../../shared/academy-contracts/index.js';
import { ApiError } from './http.js';
import { ID_RE, getAcademy, getMember } from './db.js';

export async function authenticate(request, env, deps = {}) {
  const { fetchImpl = fetch, now = Date.now(), verify = verifyFirebaseIdToken } = deps;
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError('no_token');
  let claims;
  try { claims = await verify(match[1], { projectId: env.FIREBASE_PROJECT_ID, fetchImpl, now }); } catch { throw new ApiError('invalid_token'); }
  // Contas anônimas não criam academia nem aceitam convite.
  if (claims.firebase?.sign_in_provider === 'anonymous') throw new ApiError('invalid_token');
  // Nome de exibição: só o nome da conta (texto livre, sem caracteres de controle nem < >); sem nome, "Usuário" + 4 caracteres do uid.
  // O e-mail nunca é usado nem gravado, e o nome nunca é autoridade.
  const clean = String(claims.name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80);
  return { uid: claims.sub, name: clean || `Usuário ${String(claims.sub).slice(0, 4)}` };
}

/** Valida vínculo ativo, academia ativa e papel. Devolve { membership, academy }. */
export async function requireAccess(ctx, academyId, roles) {
  if (!ID_RE.test(academyId)) throw new ApiError('invalid_request');
  const membership = await getMember(ctx.db, academyId, ctx.user.uid);
  if (!membership || membership.status === 'removed') throw new ApiError('no_membership');
  if (membership.status !== 'active') throw new ApiError('membership_inactive');
  const academy = await getAcademy(ctx.db, academyId);
  if (!academy || academy.status !== 'active') throw new ApiError('academy_unavailable');
  if (roles && !roles.includes(membership.role)) throw new ApiError('forbidden_role');
  // Limite por (academia, usuário): só quem tem vínculo consome, e um membro não esgota o limite dos colegas.
  if (await ctx.limited('academy', `ac:${academyId}:${ctx.user.uid}`)) throw new ApiError('rate_limited');
  return { membership, academy };
}

/**
 * Pode `actor` aplicar `change` ({role?, status?}) ao membro `target`? true ou um motivo.
 * Dono mexe em qualquer outro membro; admin só em coach, recepção e aluno, sem promover a admin ou dono;
 * ninguém altera o próprio vínculo por aqui (sair é outro endpoint); removido só volta pelo dono.
 */
export function canChangeMember(actor, target, change) {
  if (actor.userId === target.user_id) return 'self';
  if (!['owner', 'admin'].includes(actor.role)) return 'role';
  if (actor.role === 'admin') {
    if (!ADMIN_MANAGES.includes(target.role)) return 'role';
    if (change.role !== undefined && !ADMIN_MANAGES.includes(change.role)) return 'role';
  }
  if (target.status === 'removed' && !(change.status === 'active' && actor.role === 'owner')) return 'removed';
  return true;
}

export const canInviteRole = (actorRole, role) => !!INVITE_ROLES[actorRole] && INVITE_ROLES[actorRole].includes(role);
export const isRole = (r) => ROLES.includes(r);
