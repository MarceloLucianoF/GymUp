-- Migração 0005: novas ações de auditoria (fichas: editar, duplicar, arquivar, restaurar, lote; permissão do professor).
-- O SQLite não altera CHECK: a tabela é refeita com a lista nova, copiando os registros, e os índices e gatilhos de imutabilidade voltam.
CREATE TABLE academy_audit_log_new (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'academy.created', 'academy.updated', 'member.joined', 'member.left', 'member.role_changed', 'member.suspended', 'member.reactivated',
    'member.removed', 'invite.created', 'invite.revoked', 'ownership.transferred', 'coach.proposed', 'coach.approved', 'coach.accepted',
    'coach.rejected', 'coach.revoked', 'consent.granted', 'consent.revoked', 'training.created', 'training.published', 'training.assigned',
    'training.updated', 'training.duplicated', 'training.archived', 'training.restored', 'training.batch_assigned', 'member.permission_changed')),
  target_type TEXT NOT NULL CHECK (target_type IN ('academy', 'member', 'invite', 'assignment', 'consent', 'training')),
  target_id TEXT NOT NULL CHECK (length(target_id) BETWEEN 1 AND 120),
  detail TEXT NOT NULL DEFAULT '' CHECK (length(detail) <= 200),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  request_id TEXT NOT NULL DEFAULT '' CHECK (length(request_id) <= 64)
);
INSERT INTO academy_audit_log_new (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id)
  SELECT id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id FROM academy_audit_log;
DROP TABLE academy_audit_log;
ALTER TABLE academy_audit_log_new RENAME TO academy_audit_log;
CREATE INDEX audit_academy_created ON academy_audit_log(academy_id, created_at);
CREATE INDEX audit_academy_actor ON academy_audit_log(academy_id, actor_uid);
CREATE TRIGGER audit_immutable_update BEFORE UPDATE ON academy_audit_log BEGIN SELECT RAISE(ABORT, 'immutable_audit'); END;
CREATE TRIGGER audit_immutable_delete BEFORE DELETE ON academy_audit_log BEGIN SELECT RAISE(ABORT, 'immutable_audit'); END;
