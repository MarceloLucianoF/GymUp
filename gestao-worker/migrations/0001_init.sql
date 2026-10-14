-- BohTreinar Gestão: domínio da academia em Cloudflare D1 (SQLite). Fonte única de verdade para academias, vínculos, papéis,
-- convites, fichas versionadas, atribuições, consentimento, aderência e auditoria. O Firestore guarda só dados pessoais do aluno.
-- As garantias que antes eram regras do Firestore (isolamento entre academias, versão imutável, último dono, ficha arquivada)
-- ficam também no BANCO (chaves compostas e gatilhos), não só no código do Worker.

PRAGMA foreign_keys = ON;

CREATE TABLE academies (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 40),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Papel e status vivem SÓ aqui (nunca em users/{uid}). consent_adherence: o aluno concede e revoga; revogar apaga a aderência.
CREATE TABLE members (
  academy_id TEXT NOT NULL REFERENCES academies(id),
  user_id TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 128),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'teacher', 'reception', 'student')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed', 'left')),
  display_name TEXT NOT NULL DEFAULT '' CHECK (length(display_name) <= 80),
  email TEXT NOT NULL DEFAULT '' CHECK (length(email) <= 200),
  can_create_trainings INTEGER NOT NULL DEFAULT 0 CHECK (can_create_trainings IN (0, 1)),
  consent_adherence INTEGER NOT NULL DEFAULT 0 CHECK (consent_adherence IN (0, 1)),
  branch_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (academy_id, user_id)
);
CREATE INDEX members_user ON members(user_id);

-- Nunca deixa a academia sem dono ativo (rebaixar, suspender, remover ou apagar o último).
CREATE TRIGGER members_last_owner_update BEFORE UPDATE ON members
WHEN OLD.role = 'owner' AND OLD.status = 'active' AND (NEW.role <> 'owner' OR NEW.status <> 'active')
  AND (SELECT count(*) FROM members WHERE academy_id = OLD.academy_id AND role = 'owner' AND status = 'active' AND user_id <> OLD.user_id) = 0
BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
CREATE TRIGGER members_last_owner_delete BEFORE DELETE ON members
WHEN OLD.role = 'owner' AND OLD.status = 'active'
  AND (SELECT count(*) FROM members WHERE academy_id = OLD.academy_id AND role = 'owner' AND status = 'active' AND user_id <> OLD.user_id) = 0
BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
-- user_id e academy_id de um vínculo não mudam.
CREATE TRIGGER members_identity_frozen BEFORE UPDATE OF academy_id, user_id ON members BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;

-- O código do convite vai na URL; aqui fica só o hash (SHA-256 em hex), então um vazamento do banco não entrega convites válidos.
CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'reception', 'student')),
  max_uses INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 500),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (uses <= max_uses)
);
CREATE INDEX invites_academy ON invites(academy_id);

-- Um professor responsável por vez: no máximo uma proposta/atribuição ativa por aluno.
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'ended')),
  previous_teacher_id TEXT NOT NULL DEFAULT '',
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (teacher_id <> student_id),
  FOREIGN KEY (academy_id, student_id) REFERENCES members(academy_id, user_id),
  FOREIGN KEY (academy_id, teacher_id) REFERENCES members(academy_id, user_id)
);
CREATE UNIQUE INDEX assignments_one_open ON assignments(academy_id, student_id) WHERE status IN ('pending', 'active');
CREATE INDEX assignments_teacher ON assignments(academy_id, teacher_id, status);

CREATE TABLE training_series (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  current_version INTEGER NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json) AND json_type(draft_json, '$.exercises') = 'array' AND json_array_length(draft_json, '$.exercises') <= 20),
  source_template_id TEXT NOT NULL DEFAULT '',
  source_series_id TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, academy_id)
);
CREATE INDEX series_academy ON training_series(academy_id, status);

-- Só rascunho nunca publicado se exclui.
CREATE TRIGGER series_delete_only_draft BEFORE DELETE ON training_series WHEN OLD.current_version > 0 BEGIN SELECT RAISE(ABORT, 'published_series'); END;
CREATE TRIGGER series_academy_frozen BEFORE UPDATE OF academy_id ON training_series BEGIN SELECT RAISE(ABORT, 'immutable_academy'); END;
-- Ficha arquivada não se edita nem publica (só restaura).
CREATE TRIGGER series_archived_locked BEFORE UPDATE ON training_series
WHEN OLD.status = 'archived' AND NEW.status = 'archived' BEGIN SELECT RAISE(ABORT, 'archived_series'); END;
-- A versão nova é exatamente o próximo número.
CREATE TRIGGER series_version_step BEFORE UPDATE OF current_version ON training_series
WHEN NEW.current_version <> OLD.current_version AND NEW.current_version <> OLD.current_version + 1 BEGIN SELECT RAISE(ABORT, 'version_step'); END;

-- Versão publicada: imutável. A chave composta impede versão de uma academia em ficha de outra.
CREATE TABLE training_versions (
  series_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  exercises_json TEXT NOT NULL CHECK (json_valid(exercises_json) AND json_type(exercises_json) = 'array' AND json_array_length(exercises_json) BETWEEN 1 AND 20),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (series_id, version),
  UNIQUE (series_id, academy_id, version),
  FOREIGN KEY (series_id, academy_id) REFERENCES training_series(id, academy_id)
);
CREATE TRIGGER versions_immutable_update BEFORE UPDATE ON training_versions BEGIN SELECT RAISE(ABORT, 'immutable_version'); END;
CREATE TRIGGER versions_immutable_delete BEFORE DELETE ON training_versions BEGIN SELECT RAISE(ABORT, 'immutable_version'); END;

-- Uma ficha por aluno. A chave composta garante que a versão pertence à MESMA academia; o aluno precisa ser membro dela.
CREATE TABLE assigned_trainings (
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  series_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  teacher_id TEXT NOT NULL DEFAULT '',
  assigned_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (academy_id, student_id),
  FOREIGN KEY (academy_id, student_id) REFERENCES members(academy_id, user_id),
  FOREIGN KEY (series_id, academy_id, version) REFERENCES training_versions(series_id, academy_id, version)
);
CREATE INDEX assigned_teacher ON assigned_trainings(academy_id, teacher_id);
-- Ficha arquivada não recebe novas atribuições; só aluno ativo com papel de aluno recebe ficha.
CREATE TRIGGER assigned_series_active_insert BEFORE INSERT ON assigned_trainings
WHEN (SELECT status FROM training_series WHERE id = NEW.series_id) <> 'active' BEGIN SELECT RAISE(ABORT, 'archived_series'); END;
CREATE TRIGGER assigned_series_active_update BEFORE UPDATE ON assigned_trainings
WHEN (SELECT status FROM training_series WHERE id = NEW.series_id) <> 'active' BEGIN SELECT RAISE(ABORT, 'archived_series'); END;
CREATE TRIGGER assigned_student_only_insert BEFORE INSERT ON assigned_trainings
WHEN (SELECT role || ':' || status FROM members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_id) <> 'student:active' BEGIN SELECT RAISE(ABORT, 'not_active_student'); END;
CREATE TRIGGER assigned_student_only_update BEFORE UPDATE ON assigned_trainings
WHEN (SELECT role || ':' || status FROM members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_id) <> 'student:active' BEGIN SELECT RAISE(ABORT, 'not_active_student'); END;

-- Aderência enviada pelo aluno (autodeclarada), só com consentimento. Sem peso, medidas, cargas, volume ou horários.
CREATE TABLE adherence (
  academy_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('em_dia', 'atrasado', 'sem_dados')),
  week_workouts INTEGER NOT NULL CHECK (week_workouts BETWEEN 0 AND 21),
  active_days INTEGER NOT NULL CHECK (active_days BETWEEN 0 AND 7),
  streak INTEGER NOT NULL CHECK (streak BETWEEN 0 AND 3650),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (academy_id, user_id),
  FOREIGN KEY (academy_id, user_id) REFERENCES members(academy_id, user_id)
);
CREATE TRIGGER adherence_needs_consent BEFORE INSERT ON adherence
WHEN (SELECT consent_adherence FROM members WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id) <> 1 BEGIN SELECT RAISE(ABORT, 'no_consent'); END;
CREATE TRIGGER adherence_needs_consent_update BEFORE UPDATE ON adherence
WHEN (SELECT consent_adherence FROM members WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id) <> 1 BEGIN SELECT RAISE(ABORT, 'no_consent'); END;
-- Revogar o consentimento ou sair da academia apaga a aderência na mesma operação.
CREATE TRIGGER adherence_cleanup AFTER UPDATE OF consent_adherence, status ON members
WHEN NEW.consent_adherence = 0 OR NEW.status <> 'active' BEGIN DELETE FROM adherence WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id; END;

-- Auditoria imutável. A gravação acontece no mesmo batch (transação) da operação auditada.
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('academy', 'member', 'invite', 'assignment', 'training')),
  target_id TEXT NOT NULL CHECK (length(target_id) BETWEEN 1 AND 120),
  detail TEXT NOT NULL DEFAULT '' CHECK (length(detail) <= 200),
  at TEXT NOT NULL
);
CREATE INDEX audit_academy ON audit_log(academy_id, at);
CREATE TRIGGER audit_immutable_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'immutable_audit'); END;
CREATE TRIGGER audit_immutable_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'immutable_audit'); END;

-- Idempotência de operações em lote: mesma chave + mesmo corpo devolve o resultado salvo.
CREATE TABLE idempotency (
  academy_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (length(key) BETWEEN 8 AND 64),
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (academy_id, key)
);
