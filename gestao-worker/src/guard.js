// Cadeia de autorização de toda rota autenticada: token -> uid -> vínculo real no D1 -> academia ativa -> papel.
// academyId vem SEMPRE da URL e é conferido com o vínculo lido no banco; nada do corpo vale como autoridade.
import { verifyFirebaseIdToken } from '../../shared/firebaseAuth.js';
import { ApiError } from './contracts.js';
import { ID_RE, getAcademy, getMember } from './db.js';

export async function authenticate(request, env, deps = {}) {
  const { fetchImpl = fetch, now = Date.now(), verify = verifyFirebaseIdToken } = deps;
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError('no_token');
  let claims;
  try { claims = await verify(match[1], { projectId: env.FIREBASE_PROJECT_ID, fetchImpl, now }); } catch { throw new ApiError('invalid_token'); }
  // email só vale como dado de exibição, e só gravado quando verificado; nunca é autoridade para convite, vínculo ou papel.
  return { uid: claims.sub, email: claims.email || '', emailVerified: claims.email_verified === true, name: claims.name || '' };
}

/** Valida vínculo ativo, academia ativa e papel. Devolve { membership, academy }. */
export async function requireAccess(db, ctx, academyId, roles) {
  if (!ID_RE.test(academyId)) throw new ApiError('invalid_request');
  const membership = await getMember(db, academyId, ctx.uid);
  if (!membership) throw new ApiError('no_membership');
  if (membership.status !== 'active') throw new ApiError('membership_inactive');
  const academy = await getAcademy(db, academyId);
  if (!academy || academy.status !== 'active') throw new ApiError('academy_unavailable');
  if (roles && !roles.includes(membership.role)) throw new ApiError('forbidden_role');
  return { membership, academy };
}
