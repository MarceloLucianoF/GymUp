-- Endurecimento do esquema após revisão: limite de academias por dono no banco (sem corrida), papéis conferidos também em UPDATE,
-- versão só do número esperado e em ficha ativa, identidade congelada de verdade, limpeza só ao sair (não ao suspender).

-- 1. No máximo 5 academias ativas como dono por usuário (a checagem do Worker é só amigável; esta é a garantia).
CREATE TRIGGER members_owner_limit_insert BEFORE INSERT ON academy_members
WHEN NEW.role = 'owner' AND NEW.status = 'active'
  AND (SELECT count(*) FROM academy_members WHERE user_id = NEW.user_id AND role = 'owner' AND status = 'active') >= 5
BEGIN SELECT RAISE(ABORT, 'limit_reached'); END;
CREATE TRIGGER members_owner_limit_update BEFORE UPDATE OF role, status ON academy_members
WHEN NEW.role = 'owner' AND NEW.status = 'active' AND NOT (OLD.role = 'owner' AND OLD.status = 'active')
  AND (SELECT count(*) FROM academy_members WHERE user_id = NEW.user_id AND role = 'owner' AND status = 'active') >= 5
BEGIN SELECT RAISE(ABORT, 'limit_reached'); END;

-- 8. Congelar a identidade só quando o valor realmente muda (permite UPSERT que repete o mesmo valor).
DROP TRIGGER members_identity_frozen;
CREATE TRIGGER members_identity_frozen BEFORE UPDATE OF academy_id, user_id ON academy_members
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.user_id IS NOT OLD.user_id BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
CREATE TRIGGER consents_identity_frozen BEFORE UPDATE OF academy_id, user_id, kind ON academy_consents
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.user_id IS NOT OLD.user_id OR NEW.kind IS NOT OLD.kind BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
CREATE TRIGGER billing_identity_frozen BEFORE UPDATE OF academy_id, student_id, plan_id ON academy_billing
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_id IS NOT OLD.student_id OR NEW.plan_id IS NOT OLD.plan_id BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
CREATE TRIGGER adherence_identity_frozen BEFORE UPDATE OF academy_id, user_id ON academy_adherence
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.user_id IS NOT OLD.user_id BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
CREATE TRIGGER assignments_identity_frozen BEFORE UPDATE OF academy_id, student_id ON training_assignments
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_id IS NOT OLD.student_id BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;

-- 5. Professor-aluno: o aluno precisa ser aluno ativo e o professor precisa ser professor (ou admin/dono) ativo da mesma academia.
CREATE TRIGGER coach_roles_insert BEFORE INSERT ON coach_assignments
WHEN (SELECT role || ':' || status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.student_id) <> 'student:active'
  OR (SELECT status FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.teacher_id) IS NOT 'active'
  OR (SELECT role FROM academy_members WHERE academy_id = NEW.academy_id AND user_id = NEW.teacher_id) NOT IN ('teacher', 'admin', 'owner')
BEGIN SELECT RAISE(ABORT, 'invalid_roles'); END;
CREATE TRIGGER coach_identity_frozen BEFORE UPDATE OF academy_id, student_id, teacher_id ON coach_assignments
WHEN NEW.academy_id IS NOT OLD.academy_id OR NEW.student_id IS NOT OLD.student_id OR NEW.teacher_id IS NOT OLD.teacher_id BEGIN SELECT RAISE(ABORT, 'immutable_identity'); END;
-- Quem é aluno com registros (ficha, consentimento, cobrança, vínculo com professor) não muda de papel até esses registros serem tratados.
CREATE TRIGGER members_role_in_use BEFORE UPDATE OF role ON academy_members
WHEN OLD.role = 'student' AND NEW.role <> 'student' AND (
  EXISTS (SELECT 1 FROM training_assignments WHERE academy_id = OLD.academy_id AND student_id = OLD.user_id)
  OR EXISTS (SELECT 1 FROM academy_consents WHERE academy_id = OLD.academy_id AND user_id = OLD.user_id)
  OR EXISTS (SELECT 1 FROM academy_billing WHERE academy_id = OLD.academy_id AND student_id = OLD.user_id)
  OR EXISTS (SELECT 1 FROM coach_assignments WHERE academy_id = OLD.academy_id AND student_id = OLD.user_id AND status IN ('pending', 'active')))
BEGIN SELECT RAISE(ABORT, 'role_in_use'); END;

-- 6. Versão nova só com o número que a ficha acabou de assumir, e só em ficha ativa (o Worker sobe current_version e insere no mesmo batch).
CREATE TRIGGER versions_match_template BEFORE INSERT ON training_versions
WHEN (SELECT status FROM training_templates WHERE id = NEW.template_id) <> 'active'
  OR NEW.version <> (SELECT current_version FROM training_templates WHERE id = NEW.template_id)
BEGIN SELECT RAISE(ABORT, 'version_mismatch'); END;

-- 9. Suspender é reversível: só sair ou ser removido apaga consentimento e aderência.
DROP TRIGGER members_left_cleanup;
CREATE TRIGGER members_left_cleanup AFTER UPDATE OF status ON academy_members
WHEN NEW.status IN ('removed', 'left') BEGIN
  DELETE FROM academy_consents WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id;
  DELETE FROM academy_adherence WHERE academy_id = NEW.academy_id AND user_id = NEW.user_id;
END;
