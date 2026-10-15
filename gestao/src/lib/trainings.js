// Regras de apresentação das fichas. O servidor valida de novo (esquema fechado); isto só evita viagem de ida e volta e explica o erro.
import { LIMITS } from '../../../shared/academy-contracts/index.js';

export const emptyExercise = () => ({ name: '', muscleGroup: '', sets: '3', reps: '10', rest: 60 });
export const emptyDraft = () => ({ name: '', description: '', exercises: [emptyExercise()] });

const plain = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Devolve { name, description, exercises: { [index]: texto }, list } com mensagens em português; vazio = válido. */
export function validateDraft(draft) {
  const errors = { name: '', description: '', exercises: {}, list: '' };
  const name = String(draft.name || '').trim();
  if (name.length < 2 || name.length > 80) errors.name = 'Informe um nome com 2 a 80 caracteres.';
  if (String(draft.description || '').length > 300) errors.description = 'A descrição aceita até 300 caracteres.';
  if (draft.exercises.length < 1) errors.list = 'Inclua pelo menos um exercício.';
  if (draft.exercises.length > LIMITS.exercisesMax) errors.list = `Uma ficha aceita até ${LIMITS.exercisesMax} exercícios.`;
  const seen = new Map();
  draft.exercises.forEach((e, i) => {
    const n = String(e.name || '').trim();
    const rest = Number(e.rest);
    if (!n || n.length > 120) errors.exercises[i] = 'Informe o nome do exercício (até 120 caracteres).';
    else if (!String(e.sets || '').trim() || String(e.sets).length > 10) errors.exercises[i] = 'Informe as séries (até 10 caracteres).';
    else if (!String(e.reps || '').trim() || String(e.reps).length > 20) errors.exercises[i] = 'Informe as repetições (até 20 caracteres).';
    else if (!Number.isInteger(rest) || rest < 0 || rest > 300) errors.exercises[i] = 'O descanso vai de 0 a 300 segundos.';
    else if (seen.has(plain(n))) errors.exercises[i] = `Repetido: já existe "${n}" nesta ficha (exercício ${seen.get(plain(n)) + 1}).`;
    if (n && !seen.has(plain(n))) seen.set(plain(n), i);
  });
  return errors;
}
export const hasErrors = (e) => !!(e.name || e.description || e.list || Object.keys(e.exercises).length);

/** Corpo aceito pela API (campos fechados, números como número, textos aparados). */
export const toPayload = (draft) => ({
  name: draft.name.trim(),
  description: (draft.description || '').trim(),
  exercises: draft.exercises.map((e) => ({
    name: e.name.trim(), ...(String(e.muscleGroup || '').trim() ? { muscleGroup: String(e.muscleGroup).trim() } : {}),
    sets: String(e.sets).trim(), reps: String(e.reps).trim(), rest: Number(e.rest)
  }))
});

export const fromTemplate = (template) => ({
  name: template.name, description: template.description || '',
  exercises: template.exercises.map((e) => ({ name: e.name, muscleGroup: e.muscleGroup || '', sets: String(e.sets), reps: String(e.reps), rest: Number(e.rest) || 0 }))
});

export const move = (list, from, to) => {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

// Rótulos do resultado de cada aluno na prévia e no resultado do lote.
export const OUTCOME_LABELS = { assign: 'Será atribuída', replace: 'Troca a ficha atual', skip: 'Ignorado' };
export const SKIP_REASONS = {
  not_found: 'Não encontrado nesta academia.',
  not_active_student: 'Não é aluno ativo.',
  not_your_student: 'Não é seu aluno (sem vínculo ativo com você).',
  already_assigned: 'Já está com esta versão.',
  has_other: 'Já tem outra ficha. Marque "Substituir a ficha atual" para trocar.',
  assigned_by_other: 'A ficha atual foi atribuída por outra pessoa; só ela, o dono ou um administrador pode trocar.'
};
export const DIFF_LABELS = { added: 'Incluído', removed: 'Removido', changed: 'Alterado', moved: 'Mudou de posição', same: 'Igual' };
export const FIELD_LABELS = { muscleGroup: 'grupo', sets: 'séries', reps: 'repetições', rest: 'descanso' };
export const TEMPLATE_STATUS = { active: 'Ativa', archived: 'Arquivada' };

export const versionLabel = (v) => `v${v}`;
