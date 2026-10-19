-- Migração 0007: financeiro da academia (planos, contratos dos alunos e cobranças), sem gateway de pagamento.
-- Valores em centavos (inteiros); datas de vencimento em AAAA-MM-DD; "em atraso" não é gravado: é cobrança pendente com vencimento passado.
-- A tabela academy_billing da 0004 nunca teve dados nem tela: é refeita com as colunas que o produto precisa.

ALTER TABLE academy_plans ADD COLUMN description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 200);

CREATE TABLE student_contracts (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_uid TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  fee_cents INTEGER NOT NULL CHECK (fee_cents BETWEEN 0 AND 10000000),   -- valor combinado (pode ter desconto sobre o plano)
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  start_date TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date TEXT CHECK (end_date IS NULL OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  CHECK (status <> 'ended' OR end_date IS NOT NULL),
  UNIQUE (id, academy_id, student_uid),
  FOREIGN KEY (academy_id, student_uid) REFERENCES academy_members(academy_id, user_id),
  FOREIGN KEY (plan_id, academy_id) REFERENCES academy_plans(id, academy_id)
);
CREATE UNIQUE INDEX contracts_one_open ON student_contracts(academy_id, student_uid) WHERE status IN ('active', 'paused');
CREATE INDEX contracts_academy_status ON student_contracts(academy_id, status, start_date);
CREATE TRIGGER contracts_student_only BEFORE INSERT ON student_contracts
WHEN (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_uid) IS NOT 'student:active' BEGIN SELECT RAISE(ABORT, 'not_active_student'); END;
CREATE TRIGGER contracts_identity_frozen BEFORE UPDATE OF academy_id, student_uid ON student_contracts
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_uid IS NOT OLD.student_uid BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
CREATE TRIGGER contracts_ended_final BEFORE UPDATE ON student_contracts WHEN OLD.status = 'ended' BEGIN SELECT RAISE(ABORT, 'contract_ended'); END;
CREATE TRIGGER contracts_closed_academy BEFORE INSERT ON student_contracts
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;

DROP TRIGGER members_role_in_use;
DROP TABLE academy_billing;
CREATE TABLE academy_billing (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_uid TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  reference_month TEXT NOT NULL CHECK (reference_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 80),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 0 AND 10000000),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0 AND discount_cents <= amount_cents),
  due_date TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  billing_status TEXT NOT NULL DEFAULT 'pending' CHECK (billing_status IN ('pending', 'paid', 'exempt', 'canceled')),
  paid_at TEXT CHECK (paid_at IS NULL OR paid_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  paid_amount_cents INTEGER CHECK (paid_amount_cents IS NULL OR paid_amount_cents BETWEEN 0 AND 10000000),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('pix', 'cash', 'card', 'transfer', 'other')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 120),
  registered_by TEXT,
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  CHECK ((billing_status = 'paid' AND paid_at IS NOT NULL AND paid_amount_cents IS NOT NULL AND payment_method IS NOT NULL AND registered_by IS NOT NULL)
      OR (billing_status <> 'paid' AND paid_at IS NULL AND paid_amount_cents IS NULL AND payment_method IS NULL)),
  UNIQUE (contract_id, reference_month),
  FOREIGN KEY (contract_id, academy_id, student_uid) REFERENCES student_contracts(id, academy_id, student_uid),
  FOREIGN KEY (plan_id, academy_id) REFERENCES academy_plans(id, academy_id)
);
CREATE INDEX billing_academy_month ON academy_billing(academy_id, reference_month, billing_status);
CREATE INDEX billing_academy_due ON academy_billing(academy_id, billing_status, due_date);
CREATE INDEX billing_student ON academy_billing(academy_id, student_uid, reference_month);
CREATE TRIGGER billing_identity_frozen BEFORE UPDATE OF academy_id, student_uid, contract_id, plan_id, reference_month ON academy_billing
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_uid IS NOT OLD.student_uid OR NEW.contract_id IS NOT OLD.contract_id OR NEW.plan_id IS NOT OLD.plan_id OR NEW.reference_month IS NOT OLD.reference_month
BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
-- Cobrança cancelada é final; as demais só mudam por operação explícita do Worker (a auditoria registra quem e quando).
CREATE TRIGGER billing_canceled_final BEFORE UPDATE ON academy_billing WHEN OLD.billing_status = 'canceled' BEGIN SELECT RAISE(ABORT, 'billing_final'); END;
CREATE TRIGGER billing_closed_academy BEFORE INSERT ON academy_billing
WHEN (SELECT closed_at FROM academies WHERE id = NEW.academy_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'academy_closed'); END;
-- Quem sai da academia: contrato encerrado e cobranças pendentes canceladas (as pagas ficam como histórico).
CREATE TRIGGER members_removed_close_finance AFTER UPDATE OF status ON academy_members
WHEN NEW.status = 'removed' AND OLD.status <> 'removed'
BEGIN
  UPDATE academy_billing SET billing_status = 'canceled', updated_at = NEW.updated_at WHERE academy_id = NEW.academy_id AND student_uid = NEW.user_id AND billing_status = 'pending';
  UPDATE student_contracts SET status = 'ended', end_date = substr(NEW.updated_at, 1, 10), updated_at = NEW.updated_at WHERE academy_id = NEW.academy_id AND student_uid = NEW.user_id AND status IN ('active', 'paused');
END;

CREATE TRIGGER members_role_in_use BEFORE UPDATE OF role ON academy_members
WHEN OLD.role = 'student' AND NEW.role <> 'student' AND (
  EXISTS (SELECT 1 FROM training_assignments WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id)
  OR EXISTS (SELECT 1 FROM academy_consents WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id)
  OR EXISTS (SELECT 1 FROM student_contracts WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id AND status IN ('active', 'paused'))
  OR EXISTS (SELECT 1 FROM academy_billing WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id)
  OR EXISTS (SELECT 1 FROM coach_assignments WHERE academy_id = OLD.academy_id AND student_uid = OLD.user_id AND status IN ('proposed', 'pending_student', 'active')))
BEGIN SELECT RAISE(ABORT, 'role_in_use'); END;

-- Auditoria refeita com as ações e tipos novos (registros, índices e imutabilidade preservados).
CREATE TABLE academy_audit_log_new (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES academies(id),
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'academy.created', 'academy.updated', 'member.joined', 'member.left', 'member.role_changed', 'member.suspended', 'member.reactivated',
    'member.removed', 'invite.created', 'invite.revoked', 'ownership.transferred', 'coach.proposed', 'coach.approved', 'coach.accepted',
    'coach.rejected', 'coach.revoked', 'consent.granted', 'consent.revoked', 'training.created', 'training.published', 'training.assigned',
    'training.updated', 'training.duplicated', 'training.archived', 'training.restored', 'training.batch_assigned', 'member.permission_changed',
    'academy.exported', 'academy.closed',
    'plan.created', 'plan.updated', 'contract.created', 'contract.updated', 'billing.generated', 'billing.adjusted', 'billing.canceled', 'billing.exempted',
    'payment.registered', 'payment.reverted', 'finance.exported')),
  target_type TEXT NOT NULL CHECK (target_type IN ('academy', 'member', 'invite', 'assignment', 'consent', 'training', 'plan', 'contract', 'billing')),
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
