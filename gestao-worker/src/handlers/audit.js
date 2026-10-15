import { LIMITS } from '../../../shared/academy-contracts/index.js';
import { ApiError, intParam } from '../http.js';
import { guarded } from '../db.js';
import { requireAccess } from '../authz.js';

// Auditoria paginada por cursor (rowid decrescente): sem consulta global, sem OFFSET grande. Só nomes públicos; nunca dado de saúde.
export async function list(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, ['owner', 'admin']);
  const limit = intParam(ctx.url, 'limit', 25, 1, LIMITS.auditPageMax);
  const before = ctx.url.searchParams.has('before') ? intParam(ctx.url, 'before', 0, 1, 2_000_000_000) : null;
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT l.rowid AS cursor, l.id, l.actor_uid, l.action, l.target_type, l.target_id, l.detail, l.created_at, l.request_id,
            a.display_name AS actor_name, t.display_name AS target_name
       FROM academy_audit_log l
       LEFT JOIN academy_members a ON a.academy_id = l.academy_id AND a.user_id = l.actor_uid
       LEFT JOIN academy_members t ON t.academy_id = l.academy_id AND l.target_type = 'member' AND t.user_id = l.target_id
      WHERE l.academy_id = ? ${before ? 'AND l.rowid < ?' : ''} ORDER BY l.rowid DESC LIMIT ?`
  ).bind(...(before ? [academyId, before, limit + 1] : [academyId, limit + 1])).all());
  const page = results.slice(0, limit);
  return {
    academyId,
    entries: page.map((e) => ({ id: e.id, actorUid: e.actor_uid, actorName: e.actor_name || '', action: e.action, targetType: e.target_type, targetId: e.target_id, targetName: e.target_name || '', detail: e.detail, at: e.created_at, requestId: e.request_id })),
    nextBefore: results.length > limit ? page[page.length - 1].cursor : null
  };
}
export { ApiError };
