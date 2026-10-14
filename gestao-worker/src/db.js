// Camada de dados do D1 (única porta para o domínio da academia). Todas as consultas são parametrizadas e filtradas por academy_id;
// nada monta SQL ou caminho a partir de entrada livre. Operações que escrevem usam db.batch (transação atômica) e gravam a auditoria no MESMO batch.
import { ApiError } from './contracts.js';

export const ID_RE = /^[A-Za-z0-9_]{1,64}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const MAX_OWNED_ACADEMIES = 5;

export const newId = (length = 24) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
};
export const nowIso = (now = Date.now()) => new Date(now).toISOString();

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Violações dos gatilhos e restrições do banco viram conflito com código estável, sem a mensagem do banco.
const TRIGGER_CODES = ['last_owner', 'archived_series', 'immutable_version', 'immutable_audit', 'immutable_identity', 'immutable_academy', 'not_active_student', 'no_consent', 'student_only', 'version_step', 'version_mismatch', 'published_series', 'invalid_roles', 'role_in_use'];
export function mapDbError(error) {
  if (error instanceof ApiError) return error;
  const message = String(error?.message || '');
  if (message.includes('limit_reached')) return new ApiError('limit_reached');
  const mapped = TRIGGER_CODES.some((code) => message.includes(code)) || /UNIQUE|FOREIGN KEY|CHECK constraint/.test(message);
  // Registra o motivo real (sem o corpo da requisição): um CHECK violado por dado montado no Worker é bug, não "conflito" de usuário.
  console.error(mapped ? 'Violação do banco (conflict):' : 'Falha do banco:', message.slice(0, 200));
  return new ApiError(mapped ? 'conflict' : 'upstream_error');
}

async function guarded(fn) {
  try { return await fn(); } catch (error) { throw mapDbError(error); }
}

export const getMember = (db, academyId, uid) => guarded(() => db
  .prepare('SELECT academy_id, user_id, role, status, display_name FROM academy_members WHERE academy_id = ? AND user_id = ?')
  .bind(academyId, uid).first());

export const getAcademy = (db, academyId) => guarded(() => db
  .prepare('SELECT id, name, status FROM academies WHERE id = ?').bind(academyId).first());

// Vínculos do usuário com os dados mínimos da academia (limite fixo; "truncated" avisa se passar).
export const listMemberships = (db, uid, limit = 50) => guarded(async () => {
  const { results } = await db.prepare(
    `SELECT m.academy_id, m.role, m.status, a.name AS academy_name, a.status AS academy_status
       FROM academy_members m JOIN academies a ON a.id = m.academy_id
      WHERE m.user_id = ? ORDER BY a.name LIMIT ?`
  ).bind(uid, limit + 1).all();
  return { rows: results.slice(0, limit), truncated: results.length > limit };
});

// Só campos públicos: nunca consentimento, e-mail ou qualquer dado de treino.
export const listMembers = (db, academyId, limit = 200) => guarded(async () => {
  const { results } = await db.prepare(
    'SELECT user_id, role, status, display_name FROM academy_members WHERE academy_id = ? ORDER BY display_name, user_id LIMIT ?'
  ).bind(academyId, limit).all();
  return results;
});

export const countOwned = (db, uid) => guarded(async () => (await db
  .prepare("SELECT count(*) AS n FROM academy_members WHERE user_id = ? AND role = 'owner' AND status = 'active'").bind(uid).first()).n);

export const getIdempotent = (db, scope, key) => guarded(() => db
  .prepare('SELECT request_hash, response_json FROM idempotency_keys WHERE academy_id = ? AND key = ?').bind(scope, key).first());

// Cria academia + vínculo de dono + auditoria + chave de idempotência em UM batch: ou tudo grava, ou nada.
export function createAcademy(db, { id, auditId, name, uid, displayName, email, scope, key, requestHash, response, now }) {
  return guarded(() => db.batch([
    db.prepare('INSERT INTO academies (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, name, 'active', now, now),
    db.prepare('INSERT INTO academy_members (academy_id, user_id, role, status, display_name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, uid, 'owner', 'active', displayName, email, now, now),
    db.prepare('INSERT INTO academy_audit_log (id, academy_id, actor_id, action, target_type, target_id, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(auditId, id, uid, 'academy.created', 'academy', id, '', now),
    db.prepare('INSERT INTO idempotency_keys (academy_id, key, request_hash, response_json, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(scope, key, requestHash, JSON.stringify(response), now)
  ]));
}
