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

export const getMemberFull = (db, academyId, uid) => getMember(db, academyId, uid);

const auditStmt = (db, { id, academyId, uid, action, targetType, targetId, detail = '', now }, gated = false) => (gated
  ? db.prepare('INSERT INTO academy_audit_log (id, academy_id, actor_id, action, target_type, target_id, detail, at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1')
  : db.prepare('INSERT INTO academy_audit_log (id, academy_id, actor_id, action, target_type, target_id, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'))
  .bind(id, academyId, uid, action, targetType, targetId, detail, now);

export const createInvite = (db, { id, auditId, academyId, codeHash, role, maxUses, expiresAt, uid, now }) => guarded(() => db.batch([
  db.prepare('INSERT INTO academy_invites (id, academy_id, code_hash, role, max_uses, uses, expires_at, revoked, created_by, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?)')
    .bind(id, academyId, codeHash, role, maxUses, expiresAt, uid, now),
  auditStmt(db, { id: auditId, academyId, uid, action: 'invite.created', targetType: 'invite', targetId: id, detail: role, now })
]));

// Nunca devolve o hash nem o código.
// `roles`: lista FIXA vinda da política (nunca de entrada livre) dos papéis de convite que o ator pode ver.
export const listInvites = (db, academyId, roles, limit = 100) => guarded(async () => (await db.prepare(
  `SELECT id, role, max_uses, uses, expires_at, revoked, created_by, created_at FROM academy_invites WHERE academy_id = ? AND role IN (${roles.map(() => '?').join(', ')}) ORDER BY created_at DESC LIMIT ?`
).bind(academyId, ...roles, limit).all()).results);

export const getInvite = (db, academyId, inviteId) => guarded(() => db
  .prepare('SELECT id, role, revoked FROM academy_invites WHERE academy_id = ? AND id = ?').bind(academyId, inviteId).first());

// Revoga só convite da academia informada; auditoria só se de fato revogou (changes() = 1).
export const revokeInvite = (db, { academyId, inviteId, auditId, uid, now }) => guarded(async () => {
  const results = await db.batch([
    db.prepare('UPDATE academy_invites SET revoked = 1 WHERE academy_id = ? AND id = ? AND revoked = 0').bind(academyId, inviteId),
    auditStmt(db, { id: auditId, academyId, uid, action: 'invite.revoked', targetType: 'invite', targetId: inviteId, now }, true)
  ]);
  return (results[0]?.meta?.changes ?? 0) === 1;
});

export const getInviteByHash = (db, codeHash) => guarded(() => db.prepare(
  `SELECT i.id, i.academy_id, i.role, i.max_uses, i.uses, i.expires_at, i.revoked, a.name AS academy_name, a.status AS academy_status
     FROM academy_invites i JOIN academies a ON a.id = i.academy_id WHERE i.code_hash = ?`
).bind(codeHash).first());

/**
 * Aceita o convite em UM batch. A primeira instrução é o portão: só soma o uso se o convite está válido (não revogado, não expirado,
 * com vagas, academia ativa) E o usuário não tem vínculo diferente de 'left'. As demais só gravam se o portão passou (changes() = 1)
 * e tiram academia e papel da LINHA DO CONVITE (não de parâmetros). Quem volta depois de sair perde permissões antigas.
 * Resultado em meta.changes da primeira instrução: 0 = recusado, nada foi gravado.
 */
export const acceptInvite = (db, { inviteId, uid, displayName, email, auditId, now }) => guarded(async () => {
  const results = await db.batch([
    db.prepare(
      `UPDATE academy_invites SET uses = uses + 1
        WHERE id = ? AND revoked = 0 AND uses < max_uses AND expires_at > ?
          AND EXISTS (SELECT 1 FROM academies a WHERE a.id = academy_invites.academy_id AND a.status = 'active')
          AND NOT EXISTS (SELECT 1 FROM academy_members m WHERE m.academy_id = academy_invites.academy_id AND m.user_id = ? AND m.status <> 'left')`
    ).bind(inviteId, now, uid),
    db.prepare(
      `INSERT INTO academy_members (academy_id, user_id, role, status, display_name, email, created_at, updated_at)
       SELECT i.academy_id, ?, i.role, 'active', ?, ?, ?, ? FROM academy_invites i WHERE i.id = ? AND changes() = 1
       ON CONFLICT (academy_id, user_id) DO UPDATE SET role = excluded.role, status = 'active', display_name = excluded.display_name, email = excluded.email,
         can_create_trainings = 0, branch_id = NULL, updated_at = excluded.updated_at`
    ).bind(uid, displayName, email, now, now, inviteId),
    db.prepare(
      `INSERT INTO academy_audit_log (id, academy_id, actor_id, action, target_type, target_id, detail, at)
       SELECT ?, i.academy_id, ?, 'member.joined', 'member', ?, i.role || ',active', ? FROM academy_invites i WHERE i.id = ? AND changes() = 1`
    ).bind(auditId, uid, uid, now, inviteId)
  ]);
  return (results[0]?.meta?.changes ?? 0) === 1;
});

/**
 * Muda papel/status só se o alvo AINDA está como foi lido (papel e status esperados) e o ator continua ativo com o papel de gestão:
 * uma alteração concorrente ou um ator suspenso entre a leitura e a escrita faz a operação não gravar nada (changes = 0).
 */
export const updateMember = (db, { academyId, targetId, role, status, expectedRole, expectedStatus, actorRole, auditId, uid, now }) => guarded(async () => {
  const results = await db.batch([
    db.prepare(
      `UPDATE academy_members SET role = ?, status = ?, updated_at = ?
        WHERE academy_id = ? AND user_id = ? AND role = ? AND status = ?
          AND EXISTS (SELECT 1 FROM academy_members a WHERE a.academy_id = ? AND a.user_id = ? AND a.status = 'active' AND a.role = ?)`
    ).bind(role, status, now, academyId, targetId, expectedRole, expectedStatus, academyId, uid, actorRole),
    auditStmt(db, { id: auditId, academyId, uid, action: 'member.updated', targetType: 'member', targetId, detail: `${role},${status}`, now }, true)
  ]);
  return (results[0]?.meta?.changes ?? 0) === 1;
});

// Só sai quem está ativo: suspenso não pode "sair e voltar por convite" para escapar da suspensão.
export const leaveAcademy = (db, { academyId, uid, auditId, now }) => guarded(async () => {
  const results = await db.batch([
    db.prepare("UPDATE academy_members SET status = 'left', updated_at = ? WHERE academy_id = ? AND user_id = ? AND status = 'active'").bind(now, academyId, uid),
    auditStmt(db, { id: auditId, academyId, uid, action: 'member.left', targetType: 'member', targetId: uid, now }, true)
  ]);
  return (results[0]?.meta?.changes ?? 0) === 1;
});

export const listAudit = (db, academyId, limit = 100) => guarded(async () => (await db.prepare(
  'SELECT id, actor_id, action, target_type, target_id, detail, at FROM academy_audit_log WHERE academy_id = ? ORDER BY at DESC, rowid DESC LIMIT ?'
).bind(academyId, limit).all()).results);

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
