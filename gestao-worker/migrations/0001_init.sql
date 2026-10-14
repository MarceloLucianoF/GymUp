-- BohTreinar Gestão: domínio da academia em Cloudflare D1 (SQLite). Revisão 2 (14/10/2026), antes de qualquer produção.
-- Datas em UTC (ISO 8601 com Z). Nenhuma tabela guarda peso, medidas, cargas ou histórico detalhado de treino. Fonte única de verdade para academias, vínculos, papéis,
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

-- Papel e status vivem SÓ aqui (nunca em users/{uid}).
CREATE TABLE academy_members (
  academy_id TEXT NOT NULL REFERENCES academies(id),
  user_id TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 128),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'teacher', 'reception', 'student')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed', 'left')),
  display_name TEXT NOT NULL DEFAULT '' CHECK (length(display_name) <= 80),
  email TEXT NOT NULL DEFAULT '' CHECK (length(email) <= 200),
  can_create_trainings INTEGER NOT NULL DEFAULT 0 CHECK (can_create_trainings IN (0, 1)),
  branch_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (academy_id, user_id)
);
CREATE INDEX members_user ON academy_members(user_id);

-- Nunca deixa a academia sem dono ativo (rebaixar, suspender, remover ou apagar o último).
CREATE TRIGGER members_last_owner_update BEFORE UPDATE ON academy_members
WHEN OLD.role = 'owner' AND OLD.status = 'active' AND (NEW.role <> 'owner' OR NEW.status <> 'active')
  AND (SELECT count(*) FROM academy_members WHERE academy_id = OLD.academy_id AND role = 'owner' AND status = 'active' AND user_id <> OLD.user_id) = 0
BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
CREATE TRIGGER members_last_owner_delete BEFORE DELETE ON academy_members
WHEN OLD.role = 'owner' AND OLD.status = 'active'
  AND (SELECT count(*) FROM academy_members WHERE academy_id = OLD.academy_id AND role = 'owner' AND status = 'active' AND user_id <> OLD.user_id) = 0
BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
-- user_id e academy_id de um vínculo não mudam.
CREATE TRIGGER members_identity_frozen BEFORE UPDATE OF academy_id, user_id ON academy_members BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;

-- O código do convite vai na URL; aqui fica só o hash (SHA-256 em hex), então um vazamento do banco não entrega convites válidos.
CREATE TABLE academy_invites (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'reception', 'student')),
  max_uses INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 500),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at TEXT NOT NULL CHECK (expires_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (uses <= max_uses)
);
CREATE INDEX invites_academy ON academy_invites(academy_id);

-- Um professor responsável por vez: no máximo uma proposta/atribuição ativa por aluno.
CREATE TABLE coach_assignments (
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
  FOREIGN KEY (academy_id, student_id) REFERENCES academy_members(academy_id, user_id),
  FOREIGN KEY (academy_id, teacher_id) REFERENCES academy_members(academy_id, user_id)
);
CREATE UNIQUE INDEX assignments_one_open ON coach_assignments(academy_id, student_id) WHERE status IN ('pending', 'active');
CREATE INDEX assignments_teacher ON coach_assignments(academy_id, teacher_id, status);

CREATE TABLE training_templates (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  current_version INTEGER NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json) AND json_type(draft_json, '$.exercises') = 'array' AND json_array_length(draft_json, '$.exercises') <= 20),
  source_official_id TEXT NOT NULL DEFAULT '',
  source_template_id TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, academy_id)
);
CREATE INDEX template_academy ON training_templates(academy_id, status);

-- Só rascunho nunca publicado se exclui.
CREATE TRIGGER template_delete_only_draft BEFORE DELETE ON training_templates WHEN OLD.current_version > 0 BEGIN SELECT RAISE(ABORT, 'published_series'); END;
CREATE TRIGGER template_academy_frozen BEFORE UPDATE OF academy_id ON training_templates BEGIN SELECT RAISE(ABORT, 'immutable_academy'); END;
-- Ficha arquivada não se edita nem publica (só restaura).
CREATE TRIGGER template_archived_locked BEFORE UPDATE ON training_templates
WHEN OLD.status = 'archived' AND NEW.status = 'archived' BEGIN SELECT RAISE(ABORT, 'archived_series'); END;
-- A versão nova é exatamente o próximo número.
CREATE TRIGGER template_version_step BEFORE UPDATE OF current_version ON training_templates
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
  created_at TEXT NOT NULL,
  PRIMARY KEY (template_id, version),
  UNIQUE (template_id, academy_id, version),
  FOREIGN KEY (template_id, academy_id) REFERENCES training_templates(id, academy_id)
);
CREATE TRIGGER versions_immutable_update BEFORE UPDATE ON training_versions BEGIN SELECT RAISE(ABORT, 'immutable_version'); END;
CREATE TRIGGER versions_immutable_delete BEFORE DELETE ON training_versions BEGIN SELECT RAISE(ABORT, 'immutable_version'); END;

-- Uma ficha por aluno. A chave composta garante que a versão pertence à MESMA academia; o aluno precisa ser membro dela.
CREATE TABLE training_assignments (
  assignment_id TEXT NOT NULL UNIQUE CHECK (length(assignment_id) >= 16),   -- novo a cada (re)atribuição; o snapshot local do aluno cita este id
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  teacher_id TEXT NOT NULL DEFAULT '',
  assigned_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (academy_id, student_id),
  FOREIGN KEY (academy_id, student_id) REFERENCES academy_members(academy_id, user_id),
  FOREIGN KEY (template_id, academy_id, version) REFERENCES training_versions(template_id, academy_id, version)
);
CREATE INDEX assign_teacher ON training_assignments(academy_id, teacher_id);
-- Ficha arquivada não recebe novas atribuições; só aluno ativo com papel de aluno recebe ficha.
CREATE TRIGGER assign_template_active_insert BEFORE INSERT ON training_assignments
WHEN (SELECT status FROM training_templates WHERE id = NEW.template_id) <> 'active' BEGIN SELECT RAISE(ABORT, 'archived_series'); END;
CREATE TRIGGER assign_template_active_update BEFORE UPDATE ON training_assignments
WHEN (SELECT status FROM training_templates WHERE id = NEW.template_id) <> 'active' BEGIN SELECT RAISE(ABORT, 'archived_series'); END;
CREATE TRIGGER assign_student_only_insert BEFORE INSERT ON training_assignments
WHEN (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_id) <> 'student:active' BEGIN SELECT RAISE(ABORT, 'not_active_student'); END;
CREATE TRIGGER assign_student_only_update BEFORE UPDATE ON training_assignments
WHEN (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_id) <> 'student:active' BEGIN SELECT RAISE(ABORT, 'not_active_student'); END;

-- Consentimento do aluno (hoje só 'adherence'): por academia, revogável, com a versão do texto aceito. Sair da academia apaga.
CREATE TABLE academy_consents (
  academy_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('adherence')),
  status TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
  text_version TEXT NOT NULL CHECK (length(text_version) BETWEEN 1 AND 40),
  granted_at TEXT NOT NULL CHECK (granted_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  revoked_at TEXT CHECK (revoked_at IS NULL OR revoked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  PRIMARY KEY (academy_id, user_id, kind),
  FOREIGN KEY (academy_id, user_id) REFERENCES academy_members(academy_id, user_id)
);
CREATE TRIGGER consents_student_only BEFORE INSERT ON academy_consents
WHEN (SELECT role FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id) <> 'student' BEGIN SELECT RAISE(ABORT, 'student_only'); END;

-- Resumo de aderência ENVIADO PELO APP DO ALUNO ('client_report'): não é dado verificado. Só com consentimento concedido;
-- nenhuma decisão financeira, cobrança, punição ou ranking oficial pode se basear nele. Sem peso, medidas, cargas, volume ou horários.
CREATE TABLE academy_adherence (
  academy_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'client_report' CHECK (source = 'client_report'),
  status TEXT NOT NULL CHECK (status IN ('em_dia', 'atrasado', 'sem_dados')),
  week_workouts INTEGER NOT NULL CHECK (week_workouts BETWEEN 0 AND 21),
  active_days INTEGER NOT NULL CHECK (active_days BETWEEN 0 AND 7),
  streak INTEGER NOT NULL CHECK (streak BETWEEN 0 AND 3650),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  PRIMARY KEY (academy_id, user_id),
  FOREIGN KEY (academy_id, user_id) REFERENCES academy_members(academy_id, user_id)
);
CREATE TRIGGER adherence_needs_consent BEFORE INSERT ON academy_adherence
WHEN NOT EXISTS (SELECT 1 FROM academy_consents WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id AND kind = 'adherence' AND status = 'granted') BEGIN SELECT RAISE(ABORT, 'no_consent'); END;
CREATE TRIGGER adherence_needs_consent_update BEFORE UPDATE ON academy_adherence
WHEN NOT EXISTS (SELECT 1 FROM academy_consents WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id AND kind = 'adherence' AND status = 'granted') BEGIN SELECT RAISE(ABORT, 'no_consent'); END;
-- Revogar o consentimento, apagá-lo ou sair da academia apaga a aderência na mesma operação.
CREATE TRIGGER consents_revoked_cleanup AFTER UPDATE OF status ON academy_consents
WHEN NEW.status = 'revoked' BEGIN DELETE FROM academy_adherence WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id; END;
CREATE TRIGGER consents_deleted_cleanup AFTER DELETE ON academy_consents
BEGIN DELETE FROM academy_adherence WHERE academy_id = OLD.academy_id AND user_id = OLD.user_id; END;
CREATE TRIGGER members_left_cleanup AFTER UPDATE OF status ON academy_members
WHEN NEW.status <> 'active' BEGIN DELETE FROM academy_consents WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id; DELETE FROM academy_adherence WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id; END;

-- Planos e mensalidades (V2.2, sem gateway). A recepção lê e escreve aqui; nada daqui mistura dados de treino.
CREATE TABLE academy_plans (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  monthly_fee_cents INTEGER NOT NULL CHECK (monthly_fee_cents BETWEEN 0 AND 10000000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, academy_id)
);
CREATE TABLE academy_billing (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  billing_status TEXT NOT NULL CHECK (billing_status IN ('pending', 'paid', 'exempt', 'overdue')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 0 AND 10000000),
  due_date TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  paid_at TEXT CHECK (paid_at IS NULL OR paid_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (academy_id, student_id) REFERENCES academy_members(academy_id, user_id),
  FOREIGN KEY (plan_id, academy_id) REFERENCES academy_plans(id, academy_id)
);
CREATE INDEX billing_academy_status ON academy_billing(academy_id, billing_status, due_date);
CREATE TRIGGER billing_student_only BEFORE INSERT ON academy_billing
WHEN (SELECT role FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_id) <> 'student' BEGIN SELECT RAISE(ABORT, 'student_only'); END;

-- Auditoria imutável. A gravação acontece no mesmo batch (transação) da operação auditada.
CREATE TABLE academy_audit_log (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('academy', 'member', 'invite', 'assignment', 'training')),
  target_id TEXT NOT NULL CHECK (length(target_id) BETWEEN 1 AND 120),
  detail TEXT NOT NULL DEFAULT '' CHECK (length(detail) <= 200),
  at TEXT NOT NULL CHECK (at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
);
CREATE INDEX audit_academy ON academy_audit_log(academy_id, at);
CREATE TRIGGER audit_immutable_update BEFORE UPDATE ON academy_audit_log BEGIN SELECT RAISE(ABORT, 'immutable_audit'); END;
CREATE TRIGGER audit_immutable_delete BEFORE DELETE ON academy_audit_log BEGIN SELECT RAISE(ABORT, 'immutable_audit'); END;

-- Idempotência de operações em lote: mesma chave + mesmo corpo devolve o resultado salvo.
CREATE TABLE idempotency_keys (
  academy_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (length(key) BETWEEN 8 AND 64),
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (academy_id, key)
);
