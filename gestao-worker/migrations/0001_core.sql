-- BohTreinar Gestão: domínio da academia em Cloudflare D1 (SQLite). Migração 0001: academias, membros, convites, auditoria, idempotência.
-- Regras gerais: todas as tabelas empresariais têm academy_id; datas em UTC (ISO 8601 com Z); estados por CHECK; IDs aleatórios;
-- convite guarda só o hash do código; nenhuma tabela guarda peso, medidas, cargas ou histórico de saúde; auditoria só cresce.
-- As garantias que eram regras do Firestore ficam no BANCO (chaves compostas e gatilhos), não só no Worker.

PRAGMA foreign_keys = ON;

CREATE TABLE academies (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 40),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  contact_email TEXT NOT NULL DEFAULT '' CHECK (length(contact_email) <= 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
);
CREATE INDEX academies_status ON academies(status, updated_at);

-- Papel e status vivem SÓ aqui (nunca em users/{uid} nem no Firebase Auth). Sem e-mail: a Gestão só conhece o nome público.
CREATE TABLE academy_members (
  academy_id TEXT NOT NULL REFERENCES academies(id),
  user_id TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 128),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'coach', 'reception', 'student')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'removed')),
  display_name TEXT NOT NULL DEFAULT '' CHECK (length(display_name) <= 80),
  can_create_trainings INTEGER NOT NULL DEFAULT 0 CHECK (can_create_trainings IN (0, 1)),
  branch_id TEXT,
  removed_by TEXT,   -- uid de quem removeu; igual ao próprio user_id quando a pessoa saiu por conta própria (pode voltar por convite)
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  removed_at TEXT CHECK (removed_at IS NULL OR removed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  suspended_at TEXT CHECK (suspended_at IS NULL OR suspended_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  PRIMARY KEY (academy_id, user_id),
  CHECK (status <> 'removed' OR (removed_at IS NOT NULL AND removed_by IS NOT NULL)),
  CHECK (status <> 'suspended' OR suspended_at IS NOT NULL)
);
CREATE INDEX members_user ON academy_members(user_id, status);
CREATE INDEX members_role ON academy_members(academy_id, role, status);
CREATE INDEX members_status ON academy_members(academy_id, status, updated_at);

-- Nunca deixa a academia sem dono ativo (rebaixar, suspender, remover ou apagar o último).
CREATE TRIGGER members_last_owner_update BEFORE UPDATE ON academy_members
WHEN OLD.role = 'owner' AND OLD.status = 'active' AND (NEW.role <> 'owner' OR NEW.status <> 'active')
  AND (SELECT count(*) FROM academy_members WHERE academy_id = OLD.academy_id AND role = 'owner' AND status = 'active' AND user_id <> OLD.user_id) = 0
BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
CREATE TRIGGER members_last_owner_delete BEFORE DELETE ON academy_members
WHEN OLD.role = 'owner' AND OLD.status = 'active'
  AND (SELECT count(*) FROM academy_members WHERE academy_id = OLD.academy_id AND role = 'owner' AND status = 'active' AND user_id <> OLD.user_id) = 0
BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
-- Identidade do vínculo não muda (só quando o valor realmente muda: UPSERT com o mesmo valor passa).
CREATE TRIGGER members_identity_frozen BEFORE UPDATE OF academy_id, user_id ON academy_members
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.user_id IS NOT OLD.user_id BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
-- No máximo 5 academias ativas como dono por usuário (garantia do banco, sem corrida).
CREATE TRIGGER members_owner_limit_insert BEFORE INSERT ON academy_members
WHEN NEW.role = 'owner' AND NEW.status = 'active'
  AND (SELECT count(*) FROM academy_members WHERE user_id = NEW.user_id AND role = 'owner' AND status = 'active') >= 5
BEGIN SELECT RAISE(ABORT, 'limit_reached'); END;
CREATE TRIGGER members_owner_limit_update BEFORE UPDATE OF role, status ON academy_members
WHEN NEW.role = 'owner' AND NEW.status = 'active' AND NOT (OLD.role = 'owner' AND OLD.status = 'active')
  AND (SELECT count(*) FROM academy_members WHERE user_id = NEW.user_id AND role = 'owner' AND status = 'active') >= 5
BEGIN SELECT RAISE(ABORT, 'limit_reached'); END;

-- O código do convite vai no corpo do POST; aqui fica só o hash (SHA-256 em hex): um vazamento do banco não entrega convites válidos.
CREATE TABLE academy_invites (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'reception', 'student')),
  max_uses INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 500),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at TEXT NOT NULL CHECK (expires_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  CHECK (uses <= max_uses),
  UNIQUE (academy_id, id)
);
CREATE INDEX invites_academy_active ON academy_invites(academy_id, revoked, expires_at);
CREATE INDEX invites_academy_updated ON academy_invites(academy_id, updated_at);
CREATE INDEX invites_academy_role ON academy_invites(academy_id, role);

-- Auditoria: só cresce. Só as ações conhecidas entram; nada de payload completo nem dado de saúde (detail até 200 caracteres).
CREATE TABLE academy_audit_log (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'academy.created', 'academy.updated', 'member.joined', 'member.left', 'member.role_changed', 'member.suspended', 'member.reactivated',
    'member.removed', 'invite.created', 'invite.revoked', 'ownership.transferred', 'coach.proposed', 'coach.approved', 'coach.accepted',
    'coach.rejected', 'coach.revoked', 'consent.granted', 'consent.revoked', 'training.created', 'training.published', 'training.assigned')),
  target_type TEXT NOT NULL CHECK (target_type IN ('academy', 'member', 'invite', 'assignment', 'consent', 'training')),
  target_id TEXT NOT NULL CHECK (length(target_id) BETWEEN 1 AND 120),
  detail TEXT NOT NULL DEFAULT '' CHECK (length(detail) <= 200),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  request_id TEXT NOT NULL DEFAULT '' CHECK (length(request_id) <= 64)
);
CREATE INDEX audit_academy_created ON academy_audit_log(academy_id, created_at);
CREATE INDEX audit_academy_actor ON academy_audit_log(academy_id, actor_uid);
CREATE TRIGGER audit_immutable_update BEFORE UPDATE ON academy_audit_log BEGIN SELECT RAISE(ABORT, 'immutable_audit'); END;
CREATE TRIGGER audit_immutable_delete BEFORE DELETE ON academy_audit_log BEGIN SELECT RAISE(ABORT, 'immutable_audit'); END;

-- Idempotência: mesma chave + mesmo corpo devolve o resultado salvo.
CREATE TABLE idempotency_keys (
  academy_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (length(key) BETWEEN 8 AND 64),
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (academy_id, key)
);
CREATE INDEX idempotency_created ON idempotency_keys(created_at);
