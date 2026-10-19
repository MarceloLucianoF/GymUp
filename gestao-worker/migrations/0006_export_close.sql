-- Migração 0006: exportação e encerramento de academia (LGPD).
-- Encerrar = minimizar dados pessoais e travar a academia de forma definitiva (closed_at). A auditoria e as versões de ficha são mantidas
-- (a auditoria guarda só identificadores, para defesa e integridade; as versões são trabalho da academia, sem dado pessoal).
ALTER TABLE academies ADD COLUMN closed_at TEXT;

-- Academia encerrada não muda mais, e nada novo entra nela.
CREATE TRIGGER academies_closed_final BEFORE UPDATE ON academies WHEN OLD.closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER members_closed_academy BEFORE INSERT ON academy_members
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER invites_closed_academy BEFORE INSERT ON academy_invites
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER templates_closed_academy BEFORE INSERT ON training_templates
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;

-- Em academia encerrada ninguém volta a ficar ativo, e o último dono pode sair (o encerramento remove todos, inclusive donos).
CREATE TRIGGER members_closed_reactivate BEFORE UPDATE OF status ON academy_members
WHEN NEW.status IN ('active', 'pending') AND OLD.status <> NEW.status AND (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER coach_closed_insert BEFORE INSERT ON coach_assignments
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER coach_closed_update BEFORE UPDATE OF status ON coach_assignments
WHEN NEW.status IN ('pending_student', 'active') AND OLD.status <> NEW.status AND (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER consents_closed_insert BEFORE INSERT ON academy_consents
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER consents_closed_update BEFORE UPDATE ON academy_consents
WHEN NEW.status = 'granted' AND (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER assignments_closed_insert BEFORE INSERT ON training_assignments
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
CREATE TRIGGER assignments_closed_update BEFORE UPDATE ON training_assignments
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;

DROP TRIGGER members_last_owner_update;
DROP TRIGGER members_last_owner_delete;
CREATE TRIGGER members_last_owner_update BEFORE UPDATE ON academy_members
WHEN OLD.role = 'owner' AND OLD.status = 'active' AND (NEW.role <> 'owner' OR NEW.status <> 'active')
  AND (SELECT closed_at FROM academies WHERE id = OLD.academy_id) IS NULL
  AND (SELECT count(*) FROM academy_members WHERE academy_id = OLD.academy_id AND role = 'owner' AND status = 'active' AND user_id <> OLD.user_id) = 0
BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
CREATE TRIGGER members_last_owner_delete BEFORE DELETE ON academy_members
WHEN OLD.role = 'owner' AND OLD.status = 'active'
  AND (SELECT closed_at FROM academies WHERE id = OLD.academy_id) IS NULL
  AND (SELECT count(*) FROM academy_members WHERE academy_id = OLD.academy_id AND role = 'owner' AND status = 'active' AND user_id <> OLD.user_id) = 0
BEGIN SELECT RAISE(ABORT, 'last_owner'); END;

-- Auditoria refeita com as ações novas (o SQLite não altera CHECK); registros, índices e gatilhos de imutabilidade voltam.
CREATE TABLE academy_audit_log_new (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'academy.created', 'academy.updated', 'member.joined', 'member.left', 'member.role_changed', 'member.suspended', 'member.reactivated',
    'member.removed', 'invite.created', 'invite.revoked', 'ownership.transferred', 'coach.proposed', 'coach.approved', 'coach.accepted',
    'coach.rejected', 'coach.revoked', 'consent.granted', 'consent.revoked', 'training.created', 'training.published', 'training.assigned',
    'training.updated', 'training.duplicated', 'training.archived', 'training.restored', 'training.batch_assigned', 'member.permission_changed',
    'academy.exported', 'academy.closed')),
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
