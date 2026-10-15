-- Migração 0004: planos e cobrança (V2.2, sem gateway; sem telas nesta versão) e proteção de papel de aluno com registros.

CREATE TABLE academy_plans (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  monthly_fee_cents INTEGER NOT NULL CHECK (monthly_fee_cents BETWEEN 0 AND 10000000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  UNIQUE (id, academy_id)
);
CREATE INDEX plans_academy ON academy_plans(academy_id, active, updated_at);

CREATE TABLE academy_billing (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_uid TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  billing_status TEXT NOT NULL CHECK (billing_status IN ('pending', 'paid', 'exempt', 'overdue')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 0 AND 10000000),
  due_date TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  paid_at TEXT CHECK (paid_at IS NULL OR paid_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  FOREIGN KEY (academy_id, student_uid) REFERENCES academy_members(academy_id, user_id),
  FOREIGN KEY (plan_id, academy_id) REFERENCES academy_plans(id, academy_id)
);
CREATE INDEX billing_academy_status ON academy_billing(academy_id, billing_status, due_date);
CREATE INDEX billing_academy_updated ON academy_billing(academy_id, updated_at);
CREATE TRIGGER billing_student_only BEFORE INSERT ON academy_billing
WHEN (SELECT role FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_uid) IS NOT 'student' BEGIN SELECT RAISE(ABORT, 'student_only'); END;
CREATE TRIGGER billing_identity_frozen BEFORE UPDATE OF academy_id, student_uid, plan_id ON academy_billing
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_uid IS NOT OLD.student_uid OR NEW.plan_id IS NOT OLD.plan_id BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;

-- Aluno com ficha, consentimento, cobrança ou professor em aberto não muda de papel até esses registros serem tratados.
CREATE TRIGGER members_role_in_use BEFORE UPDATE OF role ON academy_members
WHEN OLD.role = 'student' AND NEW.role <> 'student' AND (
  EXISTS (SELECT 1 FROM training_assignments WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id)
  OR EXISTS (SELECT 1 FROM academy_consents WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id)
  OR EXISTS (SELECT 1 FROM academy_billing WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id)
  OR EXISTS (SELECT 1 FROM coach_assignments WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id AND status IN ('proposed', 'pending_student', 'active')))
BEGIN SELECT RAISE(ABORT, 'role_in_use'); END;
