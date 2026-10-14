// Camada de dados do D1 (única porta para o domínio da academia). Todas as consultas são parametrizadas e filtradas por academy_id;
// nada monta SQL a partir de entrada livre. Quem escreve usa db.batch (transação atômica) e grava a auditoria no MESMO batch.
import { ApiError } from './http.js';

export const ID_RE = /^[A-Za-z0-9_]{1,64}$/;
export const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const newId = (length = 24) => Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => ALPHABET[b % ALPHABET.length]).join('');
export const nowIso = (now = Date.now()) => new Date(now).toISOString();

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Violações de gatilhos e restrições do banco viram erro estável, sem a mensagem do banco (que fica só no log do servidor).
const TRIGGER_CONFLICTS = ['archived_template', 'immutable_version', 'immutable_audit', 'immutable_identity', 'immutable_academy', 'not_active_student', 'no_consent',
  'student_only', 'version_step', 'version_mismatch', 'published_template', 'invalid_roles', 'invalid_transition', 'role_in_use'];
export function mapDbError(error) {
  if (error instanceof ApiError) return error;
  const message = String(error?.message || '');
  if (message.includes('last_owner')) return new ApiError('last_owner');
  if (message.includes('limit_reached')) return new ApiError('limit_reached');
  const mapped = TRIGGER_CONFLICTS.some((c) => message.includes(c)) || /UNIQUE|FOREIGN KEY|CHECK constraint/.test(message);
  // Registra o motivo real (sem corpo, token ou dado pessoal): um CHECK violado por dado montado no Worker é bug, não "conflito".
  console.error(mapped ? 'Violação do banco (conflict):' : 'Falha do banco:', message.slice(0, 200));
  return new ApiError(mapped ? 'conflict' : 'upstream_error');
}
export async function guarded(fn) {
  try { return await fn(); } catch (error) { throw mapDbError(error); }
}

/** Auditoria. `gated`: só grava se a instrução anterior do batch mudou exatamente 1 linha (changes() = 1). */
export const auditStmt = (db, ctx, { academyId, action, targetType, targetId, detail = '' }, gated = false) => (gated
  ? db.prepare('INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1')
  : db.prepare('INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'))
  .bind(ctx.newId(24), academyId, ctx.user.uid, action, targetType, targetId, detail, ctx.nowIso, ctx.requestId);

export const changed = (results, index = 0) => (results[index]?.meta?.changes ?? 0) === 1;

// ---------- consultas compartilhadas ----------
export const getMember = (db, academyId, uid) => guarded(() => db
  .prepare('SELECT academy_id, user_id, role, status, display_name, can_create_trainings, removed_by FROM academy_members WHERE academy_id = ? AND user_id = ?')
  .bind(academyId, uid).first());

export const getAcademy = (db, academyId) => guarded(() => db
  .prepare('SELECT id, name, description, contact_email, status, created_at FROM academies WHERE id = ?').bind(academyId).first());

export const listMemberships = (db, uid, limit = 50) => guarded(async () => {
  const { results } = await db.prepare(
    `SELECT m.academy_id, m.role, m.status, a.name AS academy_name, a.status AS academy_status
       FROM academy_members m JOIN academies a ON a.id = m.academy_id
      WHERE m.user_id = ? AND m.status <> 'removed' ORDER BY a.name LIMIT ?`
  ).bind(uid, limit + 1).all();
  return { rows: results.slice(0, limit), truncated: results.length > limit };
});

// ---------- idempotência ----------
// Chaves de idempotência valem por 24 h: depois disso são ignoradas e apagadas na próxima gravação (a tabela não cresce para sempre).
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const getIdempotent = (db, scope, key, nowMs = Date.now()) => guarded(() => db
  .prepare('SELECT request_hash, response_json FROM idempotency_keys WHERE academy_id = ? AND key = ? AND created_at >= ?').bind(scope, key, nowIso(nowMs - IDEMPOTENCY_TTL_MS)).first());
export const idempotencyCleanupStmt = (db, ctx) => db.prepare('DELETE FROM idempotency_keys WHERE created_at < ?').bind(nowIso(ctx.now - IDEMPOTENCY_TTL_MS));
// Só grava a chave se a instrução anterior (a última da operação) mudou exatamente 1 linha: operação que não aconteceu não deixa "sucesso" salvo.
export const idempotencyStmt = (db, ctx, scope, key, requestHash, response) => db
  .prepare('INSERT INTO idempotency_keys (academy_id, key, request_hash, response_json, created_at) SELECT ?, ?, ?, ?, ? WHERE changes() = 1')
  .bind(scope, key, requestHash, JSON.stringify(response), ctx.nowIso);
