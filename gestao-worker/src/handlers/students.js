import { LIMITS, MEMBER_STATUS } from '../../../shared/academy-contracts/index.js';
import { ApiError, enumParam, intParam } from '../http.js';
import { guarded } from '../db.js';
import { requireAccess } from '../authz.js';
import { likeEscape } from './common.js';

// Alunos da academia para a gestão. Dono e admin: todos. Professor: só os alunos com vínculo ativo com ele. Recepção: cadastro (sem professor nem ficha).
// Nunca devolve peso, medidas, cargas, histórico nem consentimento.
export async function list(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'coach', 'reception']);
  const role = membership.role;
  const url = ctx.url;
  const status = enumParam(url, 'status', MEMBER_STATUS);
  const coach = url.searchParams.get('coach') || '';
  const training = url.searchParams.get('training') || '';
  for (const v of [coach, training]) if (v && v !== 'none' && !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new ApiError('invalid_request');
  if (role === 'reception' && (coach || training)) throw new ApiError('forbidden_role');
  if (role === 'coach' && coach) throw new ApiError('forbidden_role');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const pageSize = intParam(url, 'pageSize', 25, 1, LIMITS.pageSizeMax);
  const page = intParam(url, 'page', 1, 1, 1000);

  const where = ["m.academy_id = ?", "m.role = 'student'"];
  const params = [academyId];
  if (role === 'coach') { where.push("EXISTS (SELECT 1 FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active' AND c.coach_uid = ?)"); params.push(ctx.user.uid); }
  if (status) { where.push('m.status = ?'); params.push(status); } else if (role === 'coach') where.push("m.status = 'active'");
  if (q) { where.push("lower(m.display_name) LIKE ? ESCAPE '\\'"); params.push(`%${likeEscape(q.toLowerCase())}%`); }
  if (coach === 'none') where.push("NOT EXISTS (SELECT 1 FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active')");
  else if (coach) { where.push("EXISTS (SELECT 1 FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active' AND c.coach_uid = ?)"); params.push(coach); }
  if (training === 'none') where.push('NOT EXISTS (SELECT 1 FROM training_assignments a WHERE a.academy_id = m.academy_id AND a.student_uid = m.user_id)');
  else if (training) { where.push('EXISTS (SELECT 1 FROM training_assignments a WHERE a.academy_id = m.academy_id AND a.student_uid = m.user_id AND a.template_id = ?)'); params.push(training); }
  const W = where.join(' AND ');
  const total = await guarded(async () => (await ctx.db.prepare(`SELECT count(*) AS n FROM academy_members m WHERE ${W}`).bind(...params).first()).n);
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT m.user_id, m.status, m.display_name, m.created_at,
            (SELECT p.display_name FROM coach_assignments c JOIN academy_members p ON p.academy_id = c.academy_id AND p.user_id = c.coach_uid WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active') AS coach_name,
            (SELECT c.coach_uid FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active') AS coach_uid,
            (SELECT c.status FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status IN ('proposed', 'pending_student')) AS open_assignment,
            a.template_id, a.version AS training_version, a.updated_at AS assigned_at,
            (SELECT v.name FROM training_versions v WHERE v.template_id = a.template_id AND v.academy_id = a.academy_id AND v.version = a.version) AS training_name,
            (SELECT t.current_version FROM training_templates t WHERE t.id = a.template_id AND t.academy_id = a.academy_id) AS training_latest
       FROM academy_members m LEFT JOIN training_assignments a ON a.academy_id = m.academy_id AND a.student_uid = m.user_id
      WHERE ${W} ORDER BY m.display_name COLLATE NOCASE, m.user_id LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, (page - 1) * pageSize).all());
  return {
    academyId, page, pageSize, total,
    students: results.map((r) => ({
      userId: r.user_id, displayName: r.display_name, status: r.status, joinedAt: r.created_at,
      ...(role === 'reception' ? {} : {
        coach: r.coach_uid ? { userId: r.coach_uid, displayName: r.coach_name || '' } : null,
        openAssignment: r.open_assignment || null,
        training: r.template_id ? { templateId: r.template_id, name: r.training_name || '', version: r.training_version, latestVersion: r.training_latest, outdated: r.training_latest > r.training_version, assignedAt: r.assigned_at } : null
      })
    }))
  };
}
