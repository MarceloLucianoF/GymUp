// Texto de um treino para compartilhar (WhatsApp, mensagem, anotações). Só texto: nada de foto, link ou dado pessoal.
import { prescriptionLabel } from './exerciseKind';
import { comboLabel, planSummary, setPlanSummary } from './setTypes';

export function workoutShareText(workout) {
  const lines = [`Treino: ${workout?.name || 'Meu treino'}`];
  const exs = Array.isArray(workout?.exercises) ? workout.exercises : [];
  let i = 0;
  while (i < exs.length) {
    const ex = exs[i];
    const group = ex.superset;
    const members = group ? exs.slice(i).filter((e, k, arr) => e.superset === group && arr.slice(0, k).every((x) => x.superset === group)) : [ex];
    if (group && members.length > 1) {
      lines.push(`${comboLabel(members.length)} ${group}:`);
      members.forEach((m) => lines.push(`  ${exLine(m)}`));
      i += members.length;
    } else { lines.push(exLine(ex)); i += 1; }
  }
  lines.push('', 'Feito no BohTreinar');
  return lines.join('\n');
}

function exLine(ex) {
  const label = prescriptionLabel(ex);
  // com plano por série, cada série aparece com a própria meta; sem ele, o resumo dos tipos como antes
  const plan = setPlanSummary(ex) || planSummary(ex.setTypes);
  const note = ex.note ? ` (${ex.note})` : '';
  return `- ${ex.name}: ${label}${plan ? ` [${plan}]` : ''}${note}`;
}

/** Cópia do treino para salvar como novo: mesmo conteúdo, nome com "(cópia)" dentro do limite. */
export function duplicatePayload(workout) {
  const base = String(workout?.name || 'Meu treino').replace(/\s*\(cópia( \d+)?\)$/, '');
  return {
    name: `${base} (cópia)`.slice(0, 80),
    exercises: (workout?.exercises || []).map((e) => ({ ...e })),
    source: workout?.source || 'manual',
    description: workout?.description || '',
    category: workout?.category || 'Pessoal',
    photo: workout?.photo || null
  };
}
