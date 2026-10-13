// Cadeia de autorização de toda rota autenticada: token -> uid -> vínculo real -> academia ativa -> papel.
// academyId vem SEMPRE da URL e é conferido com o vínculo lido no banco; nada do corpo vale como autoridade.
import { verifyFirebaseIdToken } from '../../shared/firebaseAuth.js';
import { ApiError } from './contracts.js';
import { firestoreClient, ID_RE } from './firestore.js';

export async function authenticate(request, env, deps = {}) {
  const { fetchImpl = fetch, now = Date.now(), verify = verifyFirebaseIdToken } = deps;
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError('no_token');
  let claims;
  try { claims = await verify(match[1], { projectId: env.FIREBASE_PROJECT_ID, fetchImpl, now }); } catch { throw new ApiError('invalid_token'); }
  return { uid: claims.sub, email: claims.email || null, idToken: match[1], claims };
}

/**
 * Lê o vínculo e a academia do usuário e valida o papel. Devolve { membership, academy, db }.
 * Academia suspensa ou inacessível pelas regras -> academy_unavailable; sem vínculo -> no_membership.
 */
export async function requireAccess(ctx, academyId, roles, deps = {}) {
  if (!ID_RE.test(academyId)) throw new ApiError('invalid_request');
  const db = firestoreClient({ projectId: ctx.projectId, idToken: ctx.idToken, fetchImpl: deps.fetchImpl });
  const membership = await db.getDoc('academyMembers', `${academyId}_${ctx.uid}`);
  if (!membership || membership.academyId !== academyId || membership.userId !== ctx.uid) throw new ApiError('no_membership');
  if (membership.status !== 'active') throw new ApiError('membership_inactive');
  const academy = await db.getDoc('academies', academyId);
  if (!academy || academy.status !== 'active') throw new ApiError('academy_unavailable');
  if (roles && !roles.includes(membership.role)) throw new ApiError('forbidden_role');
  return { membership, academy, db };
}
