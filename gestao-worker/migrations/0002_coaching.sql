-- Migração 0002: vínculo professor-aluno (com aceite do aluno) e consentimento.
-- Fluxo: coach propõe -> 'proposed' (precisa de aprovação do dono/admin); dono/admin propõe -> 'pending_student';
-- o aluno aceita -> 'active'. Um professor ativo por aluno; aceitar uma nova revoga a anterior na mesma transação.

CREATE TABLE coach_assignments (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_uid TEXT NOT NULL,
  coach_uid TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'pending_student', 'active', 'rejected', 'revoked')),
  proposed_by TEXT NOT NULL,
  approved_by TEXT,
  accepted_at TEXT CHECK (accepted_at IS NULL OR accepted_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  revoked_at TEXT CHECK (revoked_at IS NULL OR revoked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  CHECK (student_uid <> coach_uid),
  CHECK (status <> 'active' OR accepted_at IS NOT NULL),
  CHECK (status NOT IN ('revoked', 'rejected') OR revoked_at IS NOT NULL),
  FOREIGN KEY (academy_id, student_uid) REFERENCES academy_members(academy_id, user_id),
  FOREIGN KEY (academy_id, coach_uid) REFERENCES academy_members(academy_id, user_id)
);
-- Uma proposta em aberto por aluno e um professor ativo por aluno.
CREATE UNIQUE INDEX coach_one_open ON coach_assignments(academy_id, student_uid) WHERE status IN ('proposed', 'pending_student');
CREATE UNIQUE INDEX coach_one_active ON coach_assignments(academy_id, student_uid) WHERE status = 'active';
CREATE INDEX coach_by_coach ON coach_assignments(academy_id, coach_uid, status);
CREATE INDEX coach_by_status ON coach_assignments(academy_id, status, updated_at);
CREATE INDEX coach_by_student ON coach_assignments(student_uid, status);

CREATE TRIGGER coach_roles_insert BEFORE INSERT ON coach_assignments
WHEN (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_uid) IS NOT 'student:active'
  OR (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.coach_uid) IS NOT 'coach:active'
BEGIN SELECT RAISE(ABORT, 'invalid_roles'); END;
CREATE TRIGGER coach_identity_frozen BEFORE UPDATE OF academy_id, student_uid, coach_uid ON coach_assignments
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_uid IS NOT OLD.student_uid OR NEW.coach_uid IS NOT OLD.coach_uid BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
-- Transições válidas; rejeitado e encerrado são finais. Ativar exige os dois lados ainda ativos.
CREATE TRIGGER coach_transition BEFORE UPDATE OF status ON coach_assignments
WHEN NEW.status <> OLD.status AND NOT (
  (OLD.status = 'proposed' AND NEW.status IN ('pending_student', 'rejected', 'revoked'))
  OR (OLD.status = 'pending_student' AND NEW.status IN ('active', 'rejected', 'revoked'))
  OR (OLD.status = 'active' AND NEW.status = 'revoked'))
BEGIN SELECT RAISE(ABORT, 'invalid_transition'); END;
CREATE TRIGGER coach_activate_roles BEFORE UPDATE OF status ON coach_assignments
WHEN NEW.status = 'active' AND OLD.status <> 'active'
  AND ((SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_uid) IS NOT 'student:active'
    OR (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.coach_uid) IS NOT 'coach:active')
BEGIN SELECT RAISE(ABORT, 'invalid_roles'); END;

-- Quem sai ou é removido, ou o professor que deixa de ser professor, perde os vínculos em aberto na mesma operação.
CREATE TRIGGER members_removed_revoke_coaching AFTER UPDATE OF status ON academy_members
WHEN NEW.status = 'removed' BEGIN
  UPDATE coach_assignments SET status = 'revoked', revoked_at = NEW.updated_at, updated_at = NEW.updated_at
   WHERE academy_id = NEW.academy_id AND (student_uid = NEW.user_id OR coach_uid = NEW.user_id) AND status IN ('proposed', 'pending_student', 'active');
END;
CREATE TRIGGER members_role_revoke_coaching AFTER UPDATE OF role ON academy_members
WHEN OLD.role = 'coach' AND NEW.role <> 'coach' BEGIN
  UPDATE coach_assignments SET status = 'revoked', revoked_at = NEW.updated_at, updated_at = NEW.updated_at
   WHERE academy_id = NEW.academy_id AND coach_uid = NEW.user_id AND status IN ('proposed', 'pending_student', 'active');
END;

-- Consentimento do aluno por academia, separado do vínculo e revogável. Hoje só prepara a V2.1: a Gestão não mostra aderência individual.
CREATE TABLE academy_consents (
  academy_id TEXT NOT NULL,
  student_uid TEXT NOT NULL,
  share_adherence INTEGER NOT NULL CHECK (share_adherence IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
  granted_at TEXT NOT NULL CHECK (granted_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  revoked_at TEXT CHECK (revoked_at IS NULL OR revoked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  PRIMARY KEY (academy_id, student_uid),
  CHECK ((status = 'granted' AND share_adherence = 1 AND revoked_at IS NULL) OR (status = 'revoked' AND share_adherence = 0 AND revoked_at IS NOT NULL)),
  FOREIGN KEY (academy_id, student_uid) REFERENCES academy_members(academy_id, user_id)
);
CREATE INDEX consents_status ON academy_consents(academy_id, status, updated_at);
CREATE TRIGGER consents_student_only BEFORE INSERT ON academy_consents
WHEN (SELECT role FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_uid) IS NOT 'student' BEGIN SELECT RAISE(ABORT, 'student_only'); END;
CREATE TRIGGER consents_identity_frozen BEFORE UPDATE OF academy_id, student_uid ON academy_consents
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_uid IS NOT OLD.student_uid BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
-- Quem sai da academia (ou é removido) tem o consentimento revogado na mesma operação; suspender não revoga (é reversível).
CREATE TRIGGER members_removed_revoke_consent AFTER UPDATE OF status ON academy_members
WHEN NEW.status = 'removed' BEGIN
  UPDATE academy_consents SET status = 'revoked', share_adherence = 0, revoked_at = NEW.updated_at, updated_at = NEW.updated_at
   WHERE academy_id = NEW.academy_id AND student_uid = NEW.user_id AND status = 'granted';
END;
