-- Migração 0003: fichas da academia (modelo/rascunho), versões imutáveis e atribuição ao aluno.

CREATE TABLE training_templates (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  current_version INTEGER NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json) AND json_type(draft_json, '$.exercises') = 'array' AND json_array_length(draft_json, '$.exercises') <= 20),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  UNIQUE (id, academy_id)
);
CREATE INDEX templates_academy ON training_templates(academy_id, status, updated_at);
CREATE TRIGGER templates_delete_only_draft BEFORE DELETE ON training_templates WHEN OLD.current_version > 0 BEGIN SELECT RAISE(ABORT, 'published_template'); END;
CREATE TRIGGER templates_academy_frozen BEFORE UPDATE OF academy_id ON training_templates BEGIN SELECT RAISE(ABORT, 'immutable_academy'); END;
CREATE TRIGGER templates_archived_locked BEFORE UPDATE ON training_templates WHEN OLD.status = 'archived' AND NEW.status = 'archived' BEGIN SELECT RAISE(ABORT, 'archived_template'); END;
CREATE TRIGGER templates_version_step BEFORE UPDATE OF current_version ON training_templates
WHEN NEW.current_version <> OLD.current_version AND NEW.current_version <> OLD.current_version + 1 BEGIN SELECT RAISE(ABORT, 'version_step'); END;

-- Versão publicada: imutável. A chave composta impede versão de uma academia em ficha de outra.
CREATE TABLE training_versions (
  template_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  exercises_json TEXT NOT NULL CHECK (json_valid(exercises_json) AND json_type(exercises_json) = 'array' AND json_array_length(exercises_json) BETWEEN 1 AND 20),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),   -- SHA-256 (hex) de nome, descrição e exercícios; vai no snapshot offline do aluno
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  PRIMARY KEY (template_id, version),
  UNIQUE (template_id, academy_id, version),
  FOREIGN KEY (template_id, academy_id) REFERENCES training_templates(id, academy_id)
);
CREATE INDEX versions_academy ON training_versions(academy_id, created_at);
CREATE TRIGGER versions_immutable_update BEFORE UPDATE ON training_versions BEGIN SELECT RAISE(ABORT, 'immutable_version'); END;
CREATE TRIGGER versions_immutable_delete BEFORE DELETE ON training_versions BEGIN SELECT RAISE(ABORT, 'immutable_version'); END;
-- Versão nova só com o número que a ficha acabou de assumir, e só em ficha ativa.
CREATE TRIGGER versions_match_template BEFORE INSERT ON training_versions
WHEN (SELECT status FROM training_templates WHERE id = NEW.template_id) IS NOT 'active'
  OR NEW.version <> (SELECT current_version FROM training_templates WHERE id = NEW.template_id)
BEGIN SELECT RAISE(ABORT, 'version_mismatch'); END;

-- Uma ficha por aluno. assignment_id novo a cada (re)atribuição: o snapshot local do aluno cita este id.
CREATE TABLE training_assignments (
  assignment_id TEXT NOT NULL UNIQUE CHECK (length(assignment_id) >= 16),
  academy_id TEXT NOT NULL,
  student_uid TEXT NOT NULL,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  assigned_by TEXT NOT NULL,
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  PRIMARY KEY (academy_id, student_uid),
  FOREIGN KEY (academy_id, student_uid) REFERENCES academy_members(academy_id, user_id),
  FOREIGN KEY (template_id, academy_id, version) REFERENCES training_versions(template_id, academy_id, version)
);
CREATE INDEX assignments_template ON training_assignments(academy_id, template_id);
-- Quem sai ou é removido perde a ficha atribuída (ao voltar por convite não reaparece uma ficha antiga).
CREATE TRIGGER members_removed_drop_training AFTER UPDATE OF status ON academy_members
WHEN NEW.status = 'removed' BEGIN DELETE FROM training_assignments WHERE academy_id = NEW.academy_id AND student_uid = NEW.user_id; END;
CREATE TRIGGER assignments_identity_frozen BEFORE UPDATE OF academy_id, student_uid ON training_assignments
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_uid IS NOT OLD.student_uid BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
CREATE TRIGGER assignments_template_active_insert BEFORE INSERT ON training_assignments
WHEN (SELECT status FROM training_templates WHERE id = NEW.template_id) IS NOT 'active' BEGIN SELECT RAISE(ABORT, 'archived_template'); END;
CREATE TRIGGER assignments_template_active_update BEFORE UPDATE ON training_assignments
WHEN (SELECT status FROM training_templates WHERE id = NEW.template_id) IS NOT 'active' BEGIN SELECT RAISE(ABORT, 'archived_template'); END;
CREATE TRIGGER assignments_student_only_insert BEFORE INSERT ON training_assignments
WHEN (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_uid) IS NOT 'student:active' BEGIN SELECT RAISE(ABORT, 'not_active_student'); END;
CREATE TRIGGER assignments_student_only_update BEFORE UPDATE ON training_assignments
WHEN (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_uid) IS NOT 'student:active' BEGIN SELECT RAISE(ABORT, 'not_active_student'); END;
