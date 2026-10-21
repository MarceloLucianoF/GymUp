// Tipos de série: normal, aquecimento, drop-set e até a falha. O tipo de cada série pode vir planejado na ficha (`setTypes`) e o aluno
// ajusta na hora. Aquecimento não entra em volume, recorde nem 1RM. Superset: exercícios seguidos com a mesma letra (`superset: 'A'`)
// são feitos alternando, sem descanso entre eles; o descanso vem depois do último do grupo.
export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'];
export const SET_LABELS = { normal: 'Normal', warmup: 'Aquecimento', drop: 'Drop-set', failure: 'Até a falha' };
export const SET_SHORT = { normal: 'Normal', warmup: 'Aquec.', drop: 'Drop', failure: 'Falha' };
export const SET_HINTS = {
  normal: 'Série de trabalho.',
  warmup: 'Série leve para preparar. Não conta no volume nem nos recordes.',
  drop: 'Ao terminar, reduza cerca de 30% da carga e continue até a falha.',
  failure: 'Vá até não conseguir mais uma repetição com boa forma.'
};

export const isSetType = (t) => SET_TYPES.includes(t);
export const countsAsWork = (type) => type !== 'warmup';
export const nextSetType = (t) => SET_TYPES[(Math.max(0, SET_TYPES.indexOf(t)) + 1) % SET_TYPES.length];

/** Lista de tipos com exatamente `count` posições; valor inválido ou ausente vira "normal". */
export const normalizeSetTypes = (types, count) => {
  const n = Math.max(0, Math.min(12, Number(count) || 0));
  const list = Array.isArray(types) ? types : [];
  return Array.from({ length: n }, (_, i) => (isSetType(list[i]) ? list[i] : 'normal'));
};

export const hasPlan = (types) => Array.isArray(types) && types.some((t) => isSetType(t) && t !== 'normal');

/** "Aquec. + 2 normais + Drop": resumo curto do plano; sequências iguais viram contagem ("3 Drop"). Vazio quando tudo é normal. */
export const planSummary = (types) => {
  if (!hasPlan(types)) return '';
  const norm = types.map((t) => (isSetType(t) ? t : 'normal'));
  const out = [];
  for (let i = 0; i < norm.length;) {
    let j = i;
    while (j < norm.length && norm[j] === norm[i]) j += 1;
    const n = j - i;
    const t = norm[i];
    out.push(t === 'normal' ? `${n} ${n === 1 ? 'normal' : 'normais'}` : n === 1 ? SET_SHORT[t] : `${n} ${SET_SHORT[t]}`);
    i = j;
  }
  return out.join(' + ');
};

// ---- supersets ----
const letter = (v) => (typeof v === 'string' && /^[A-Z]$/.test(v) ? v : null);

/** Posição do exercício dentro do superset: { group, first, last, firstIndex, nextIndex } ou null. */
export function supersetRole(exercises, index) {
  const group = letter(exercises?.[index]?.superset);
  if (!group) return null;
  let first = index;
  while (first > 0 && letter(exercises[first - 1]?.superset) === group) first -= 1;
  let end = index;
  while (end + 1 < exercises.length && letter(exercises[end + 1]?.superset) === group) end += 1;
  if (first === end) return null;   // letra sozinha não é superset
  return { group, first: index === first, last: index === end, firstIndex: first, lastIndex: end, nextIndex: index < end ? index + 1 : null, size: end - first + 1 };
}

/** O que fazer ao concluir uma série: iniciar descanso? ir para qual exercício? (o descanso só vem depois do último do grupo) */
export function afterSetAction(exercises, exIndex, setIndex, totalSets) {
  const role = supersetRole(exercises, exIndex);
  if (!role) return { rest: true, goTo: null };
  if (!role.last) return { rest: false, goTo: role.nextIndex };
  const moreSets = setIndex < totalSets - 1;
  return { rest: true, goTo: moreSets ? role.firstIndex : null };
}

/** Marcas "liga ao próximo" -> letras A, B, C... em sequência; só quem está ligado a vizinho recebe letra. */
export function assignSupersetLetters(links) {
  const out = (links || []).map(() => null);
  let code = 65;
  for (let i = 0; i < out.length; i += 1) {
    if (!links[i] || i === out.length - 1) continue;
    const start = i;
    while (i < out.length - 1 && links[i]) i += 1;
    const ch = String.fromCharCode(Math.min(90, code)); code += 1;
    for (let k = start; k <= i; k += 1) out[k] = ch;
  }
  return out;
}

/** Letras salvas -> marcas "liga ao próximo" (para o editor). */
export const supersetLinks = (exercises) => (exercises || []).map((e, i, arr) => !!letter(e?.superset) && letter(arr[i + 1]?.superset) === letter(e?.superset));
