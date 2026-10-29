// Tipos de série: normal, aquecimento, drop-set, até a falha e cluster. O tipo de cada série pode vir planejado na ficha (`setTypes`) e o aluno
// ajusta na hora. Aquecimento não entra em volume, recorde nem 1RM. Superset: exercícios seguidos com a mesma letra (`superset: 'A'`)
// são feitos alternando, sem descanso entre eles; o descanso vem depois do último do grupo.
export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure', 'cluster'];
export const SET_LABELS = { normal: 'Normal', warmup: 'Aquecimento', drop: 'Drop-set', failure: 'Até a falha', cluster: 'Cluster' };
export const SET_SHORT = { normal: 'Normal', warmup: 'Aquec.', drop: 'Drop', failure: 'Falha', cluster: 'Cluster' };
export const SET_HINTS = {
  normal: 'Série de trabalho.',
  warmup: 'Série leve para preparar. Não conta no volume nem nos recordes.',
  drop: 'Ao terminar, reduza cerca de 30% da carga e continue até a falha.',
  failure: 'Vá até não conseguir mais uma repetição com boa forma.',
  cluster: 'Faça a série em blocos curtos, com poucos segundos de pausa entre eles.'
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

// ---- plano por série (`setPlan`) ----
// Array opcional por exercício, índice = série. Cada item tem campos opcionais:
// { reps: '6-10', isoBeforeSec: 10, isoAfterSec: 5, drops: [{ load: 16 }, { load: 12 }], failure: true, blocks: [4, 4, 4], blockRestSec: 10 }.
// Item vazio ({}) = série como a prescrição geral. Sem `setPlan`, a ficha funciona como antes.
export const PLAN_LIMITS = { sets: 12, drops: 4, blocks: 6, isoSec: 120, blockRestSec: 60, blockReps: 50, load: 1000, reps: 12 };

const int = (v, max) => { const n = Math.round(Number(String(v ?? '').replace(',', '.'))); return Number.isFinite(n) && n > 0 ? Math.min(max, n) : null; };
const kg = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.min(PLAN_LIMITS.load, Math.round(n * 100) / 100) : null; };
const REPS_RE = /^\d{1,3}(-\d{1,3})?$/;

/** Item do plano limpo (números válidos, listas no limite); null quando não sobra nada. */
export function normalizePlanItem(item) {
  if (!item || typeof item !== 'object') return null;
  const out = {};
  const reps = String(item.reps ?? '').replace(/\s+/g, '').slice(0, PLAN_LIMITS.reps);
  if (REPS_RE.test(reps)) out.reps = reps;
  const before = int(item.isoBeforeSec, PLAN_LIMITS.isoSec);
  const after = int(item.isoAfterSec, PLAN_LIMITS.isoSec);
  if (before) out.isoBeforeSec = before;
  if (after) out.isoAfterSec = after;
  if (Array.isArray(item.drops) && item.drops.length) {
    out.drops = item.drops.slice(0, PLAN_LIMITS.drops).map((d) => { const load = kg(d?.load); return load ? { load } : {}; });
  }
  if (item.failure === true) out.failure = true;
  if (Array.isArray(item.blocks)) {
    const blocks = item.blocks.slice(0, PLAN_LIMITS.blocks).map((b) => int(b, PLAN_LIMITS.blockReps) || 1);
    if (blocks.length >= 2) {
      out.blocks = blocks;
      out.blockRestSec = int(item.blockRestSec, PLAN_LIMITS.blockRestSec) || 10;
    }
  }
  if (out.drops && out.blocks) { delete out.blocks; delete out.blockRestSec; }   // drop e cluster na mesma série não combinam
  return Object.keys(out).length ? out : null;
}

/** Plano com exatamente `count` posições (vazias = {}); null quando nenhuma série tem algo próprio. */
export function normalizeSetPlan(plan, count) {
  if (!Array.isArray(plan)) return null;
  const n = Math.max(0, Math.min(PLAN_LIMITS.sets, Number(count) || 0));
  const items = Array.from({ length: n }, (_, i) => normalizePlanItem(plan[i]));
  return items.some(Boolean) ? items.map((it) => it || {}) : null;
}

export const hasSetPlan = (plan) => Array.isArray(plan) && plan.some((it) => !!normalizePlanItem(it));

/** Tipo da série que o item implica (drop, cluster, falha) ou null quando só muda reps/isometria. */
export const planItemType = (item) => (item?.drops?.length ? 'drop' : item?.blocks?.length >= 2 ? 'cluster' : item?.failure ? 'failure' : null);

/** Repetições previstas da série: as próprias do plano, senão as do exercício. */
export const planReps = (ex, i) => {
  const item = Array.isArray(ex?.setPlan) ? ex.setPlan[i] : null;
  return item?.reps ? String(item.reps) : String(ex?.reps ?? '10');
};

const fmt = (n) => String(n).replace('.', ',');

/** Rótulo curto de uma série: "10'' iso + 15", "15 + 5'' iso", "6-10 + drop 16/12", "6-10 até a falha", "4-4-4 (10 s)". */
export function planLabel(item, defaultReps = '') {
  const it = normalizePlanItem(item) || {};
  if (it.blocks) return `${it.blocks.join('-')} (${it.blockRestSec} s)`;
  let out = String(it.reps || defaultReps || '');
  if (it.isoBeforeSec) out = `${it.isoBeforeSec}'' iso${out ? ` + ${out}` : ''}`;
  if (it.isoAfterSec) out = `${out ? `${out} + ` : ''}${it.isoAfterSec}'' iso`;
  if (it.drops) {
    const loads = it.drops.map((d) => d.load).filter(Boolean);
    out = `${out ? `${out} + ` : ''}drop${loads.length ? ` ${loads.map(fmt).join('/')}` : it.drops.length > 1 ? ` x${it.drops.length}` : ''}`;
  }
  if (it.failure) out = `${out ? `${out} ` : ''}até a falha`;
  return out;
}

/** "S1 15 · S2 10'' iso + 15 · ...": o plano inteiro em uma linha (vazio sem plano). Aquecimento ganha "Aquec.". */
export function setPlanSummary(ex) {
  if (!hasSetPlan(ex?.setPlan)) return '';
  const count = Math.max(1, Math.min(PLAN_LIMITS.sets, parseInt(ex.sets, 10) || ex.setPlan.length));
  return Array.from({ length: count }, (_, i) => {
    const label = planLabel(ex.setPlan[i], ex.reps);
    return `S${i + 1} ${ex.setTypes?.[i] === 'warmup' ? `Aquec. ${label}` : label}`;
  }).join(' · ');
}

// Técnica escolhida no editor: um menu por série. Cada uma vira um tipo (`setTypes`) e campos do item (`setPlan`).
export const TECHNIQUES = [
  { id: 'normal', label: 'Normal', type: 'normal' },
  { id: 'warmup', label: 'Aquecimento', type: 'warmup' },
  { id: 'isoBefore', label: 'Isometria antes', type: 'normal' },
  { id: 'isoAfter', label: 'Isometria depois', type: 'normal' },
  { id: 'drop', label: 'Drop', type: 'drop' },
  { id: 'dropFailure', label: 'Drop + falha', type: 'drop' },
  { id: 'failure', label: 'Até a falha', type: 'failure' },
  { id: 'cluster', label: 'Cluster', type: 'cluster' }
];

/** Técnica atual de uma série a partir do tipo e do item. */
export function techniqueOf(type, item) {
  const it = item || {};
  if (it.blocks?.length >= 2 || type === 'cluster') return 'cluster';
  if (it.drops?.length || type === 'drop') return it.failure ? 'dropFailure' : 'drop';
  if (it.failure || type === 'failure') return 'failure';
  if (type === 'warmup') return 'warmup';
  if (it.isoBeforeSec) return 'isoBefore';
  if (it.isoAfterSec) return 'isoAfter';
  return 'normal';
}

/** Troca a técnica de uma série: mantém as reps próprias e aproveita o que já havia (cargas do drop, blocos); preenche o padrão do resto. */
export function applyTechnique(id, item = {}) {
  const tech = TECHNIQUES.find((t) => t.id === id) || TECHNIQUES[0];
  const next = item?.reps ? { reps: item.reps } : {};
  if (id === 'isoBefore') next.isoBeforeSec = item?.isoBeforeSec || 10;
  if (id === 'isoAfter') next.isoAfterSec = item?.isoAfterSec || 5;
  if (id === 'drop' || id === 'dropFailure') next.drops = item?.drops?.length ? item.drops : [{}];
  if (id === 'dropFailure' || id === 'failure') next.failure = true;
  if (id === 'cluster') { next.blocks = item?.blocks?.length >= 2 ? item.blocks : [4, 4, 4]; next.blockRestSec = item?.blockRestSec || 10; delete next.reps; }
  return { type: tech.type, item: next };
}

// ---- partes registradas na execução (drop e cluster) ----
// A série guarda weight/reps da 1ª parte (recorde e 1RM usam só ela) e `parts: [{ weight, reps }]` com todas, em ordem.

/** Volume da série: soma das partes quando houver, senão carga x reps. */
export const setVolume = (s) => {
  const n = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
  if (Array.isArray(s?.parts) && s.parts.length) return s.parts.reduce((acc, p) => acc + n(p?.weight) * n(p?.reps), 0);
  return n(s?.weight) * n(s?.reps);
};

/** "20+16+12" e "8+6+4" para mostrar uma série com partes (ou os valores simples). */
export const partsText = (s, field) => (Array.isArray(s?.parts) && s.parts.length > 1 ? s.parts.map((p) => fmt(p?.[field] ?? 0)).join('+') : (s?.[field] || ''));

// ---- supersets ----
const letter = (v) => (typeof v === 'string' && /^[A-Z]$/.test(v) ? v : null);

/** Rótulo do grupo combinado pelo tamanho (só interface; o campo salvo continua `superset`): 2 Bi-set, 3 Tri-set, 4+ Circuito. */
export const comboLabel = (size) => (size === 2 ? 'Bi-set' : size === 3 ? 'Tri-set' : size >= 4 ? 'Circuito' : 'Exercícios combinados');

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
