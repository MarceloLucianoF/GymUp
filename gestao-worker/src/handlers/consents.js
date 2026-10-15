import { SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { ApiError, readBody } from '../http.js';
import { auditStmt, changed, guarded } from '../db.js';
import { requireAccess } from '../authz.js';

// Consentimento do aluno por academia, separado do vínculo e revogável. A Gestão não mostra aderência individual nesta versão;
// o registro existe para a V2.1. Só o próprio aluno concede ou revoga.
export async function get(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, ['student']);
  const row = await guarded(() => ctx.db.prepare('SELECT share_adherence, status, granted_at, revoked_at FROM academy_consents WHERE academy_id = ? AND student_uid = ?').bind(academyId, ctx.user.uid).first());
  return { academyId, shareAdherence: row ? row.share_adherence === 1 : false, status: row ? row.status : 'none', grantedAt: row?.granted_at || null, revokedAt: row?.revoked_at || null };
}

export async function put(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, ['student']);
  const { shareAdherence } = await readBody(ctx.request, SCHEMAS.consent);
  const { db } = ctx;
  const stmts = shareAdherence
    ? [db.prepare(
        `INSERT INTO academy_consents (academy_id, student_uid, share_adherence, status, granted_at, revoked_at, updated_at) VALUES (?, ?, 1, 'granted', ?, NULL, ?)
         ON CONFLICT (academy_id, student_uid) DO UPDATE SET share_adherence = 1, status = 'granted', granted_at = excluded.granted_at, revoked_at = NULL, updated_at = excluded.updated_at
         WHERE academy_consents.status = 'revoked'`).bind(academyId, ctx.user.uid, ctx.nowIso, ctx.nowIso),
       auditStmt(db, ctx, { academyId, action: 'consent.granted', targetType: 'consent', targetId: ctx.user.uid }, true)]
    : [db.prepare("UPDATE academy_consents SET share_adherence = 0, status = 'revoked', revoked_at = ?, updated_at = ? WHERE academy_id = ? AND student_uid = ? AND status = 'granted'").bind(ctx.nowIso, ctx.nowIso, academyId, ctx.user.uid),
       auditStmt(db, ctx, { academyId, action: 'consent.revoked', targetType: 'consent', targetId: ctx.user.uid }, true)];
  const results = await guarded(() => db.batch(stmts));
  // Repetir o mesmo estado é inofensivo: nada muda, nada é auditado, e a resposta diz o estado atual.
  if (!changed(results)) return { academyId, shareAdherence, unchanged: true };
  return { academyId, shareAdherence };
}
