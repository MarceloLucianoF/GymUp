// Tipos de exercício e como cada um é prescrito. Musculação tem séries, repetições e descanso; prancha e isometria têm séries de
// segundos; esteira, bicicleta e escada têm só minutos. Em todos os tipos o campo `reps` guarda o número da prescrição
// (repetições, segundos ou minutos), então fichas antigas e o histórico continuam lendo o mesmo campo.
const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const KINDS = ['strength', 'timed', 'cardio'];
export const KIND_LABELS = { strength: 'Musculação (séries e repetições)', timed: 'Por tempo (prancha, isometria)', cardio: 'Cardio (esteira, bike, escada)' };

const CARDIO_NAME = /esteira|\bbike\b|bicicleta ergom|escada|eliptico|hiit|corrida|caminhada|pular corda|remo ergom|spinning|transport/;
const TIMED_NAME = /prancha|isometri|dead hang|suspensao|parede isometrica|wall sit|\bhollow\b|alongamento|postura da crianca|\(cat stretch\)|aquecimento/;

export function exerciseKind(ex) {
  if (KINDS.includes(ex?.kind)) return ex.kind;
  if (ex?.cardio === true) return 'cardio';
  const group = plain(ex?.muscleGroup || ex?.category);
  const name = plain(ex?.name);
  if (/^(cardio|aerobi)/.test(group) || CARDIO_NAME.test(name)) return 'cardio';
  if (TIMED_NAME.test(name)) return 'timed';
  return 'strength';
}

const num = (v, fallback) => { const n = parseInt(String(v ?? '').split('-')[0], 10); return Number.isFinite(n) && n > 0 ? n : fallback; };

/** Minutos de um exercício de cardio (0 ou vazio vira 20, nunca "10 repetições de esteira"). */
export const cardioMinutes = (ex) => num(ex?.durationMin, num(ex?.reps, 20));
export const timedSeconds = (ex) => num(ex?.reps, 30);

/** "3 x 10", "3 x 30 s" ou "25 min": o que aparece como meta em qualquer tela. */
export function prescriptionLabel(ex) {
  const kind = exerciseKind(ex);
  if (kind === 'cardio') return `${cardioMinutes(ex)} min`;
  const sets = num(ex?.sets, 3);
  if (kind === 'timed') return `${sets} x ${timedSeconds(ex)} s`;
  return `${sets} x ${String(ex?.reps ?? '10') === '0' || !ex?.reps ? '10' : ex.reps}`;
}

export const repsFieldLabel = (kind) => ({ cardio: 'Duração (min)', timed: 'Tempo (s)' }[kind] || 'Repetições');
export const repsPlaceholder = (kind) => ({ cardio: '25', timed: '30' }[kind] || '10 ou 8-12');
/** Valor sugerido quando o tipo muda (a prescrição antiga não faz sentido no tipo novo). */
export const defaultsForKind = (kind) => ({ cardio: { sets: '1', reps: '25', rest: 0 }, timed: { sets: '3', reps: '30', rest: 45 } }[kind] || { sets: '3', reps: '10', rest: 60 });

/** Compara dificuldade ignorando acento e caixa ("avancado" = "Avançado"). */
export const sameDifficulty = (a, b) => plain(a) === plain(b);
