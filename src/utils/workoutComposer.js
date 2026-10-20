import { equipmentOf } from './equipment';
import { catalogKey } from './exerciseCatalog';
import { defaultsForKind, exerciseKind } from './exerciseKind';
// Composição de fichas por IA com a biblioteca como fonte de verdade.
// Fluxo: pedido -> foco (spec) -> filtro determinístico da biblioteca -> candidatos enviados à IA (só metadados necessários)
// -> resposta validada por ID e por composição -> se falhar, montagem determinística (a ficha é válida mesmo sem IA).

export const plain = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export class InsufficientExercisesError extends Error {
  constructor(message) { super(message); this.name = 'InsufficientExercisesError'; }
}

// ---- grupos (mesmos rótulos da biblioteca: "pernas", "perna", "gluteo", "braços"...) ----
export const canonicalGroup = (value) => {
  const g = plain(value);
  if (/peit/.test(g)) return 'peito';
  if (/costa|dorsal|trapez|lombar/.test(g)) return 'costas';
  if (/ombro|deltoid/.test(g)) return 'ombros';
  if (/biceps|triceps|braco|antebraco/.test(g)) return 'bracos';
  if (/perna|quadric|posterior|gluteo|panturrilha|coxa|adutor|abdutor|inferior/.test(g)) return 'pernas';
  if (/core|abdom|abdominal/.test(g)) return 'core';
  if (/cardio|aerobi/.test(g)) return 'cardio';
  return g || 'geral';
};

export const idOf = (name) => plain(name).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Subgrupo principal da perna (conta para a composição) e os secundários (informativos).
function legSubgroups(n) {
  if (/panturrilha/.test(n)) return ['panturrilhas'];
  if (/adutora/.test(n)) return ['adutores'];
  if (/flexora|stiff|romeno|good morning|flexao nordica(?! inversa)/.test(n)) return ['posterior'];
  if (/hip thrust|pelvica|gluteo|glute|abdutora|kickback/.test(n)) return /hip thrust|pelvica|gluteo|glute/.test(n) ? ['gluteos', 'posterior'] : ['gluteos'];
  return /afundo|passada|agachamento|leg press|hack/.test(n) ? ['quadriceps', 'gluteos'] : ['quadriceps'];
}

function patternOf(n, group) {
  if (/leg press|supino|desenvolvimento|chest press|flexao de braco/.test(n)) return 'empurrar';
  if (/agachamento|hack|afundo|passada|sissy|flexao nordica/.test(n)) return 'agachar';
  if (/stiff|romeno|hip thrust|pelvica|good morning|terra/.test(n)) return 'dobradica';
  if (/remada|puxada|barra fixa|pulldown|pull/.test(n)) return 'puxar';
  if (group === 'core') return 'estabilizar';
  return 'isolado';
}

/** Metadados normalizados de um exercício da biblioteca. `ref` guarda o objeto original (imagens, descrição, firestoreId). */
export function normalizeExercise(ex) {
  const name = String(ex?.name || '').trim();
  const n = plain(name);
  const primaryGroup = canonicalGroup(ex?.muscleGroup || ex?.category);
  let subgroups = [primaryGroup];
  if (primaryGroup === 'pernas') subgroups = legSubgroups(n);
  else if (primaryGroup === 'bracos') subgroups = [/triceps|francesa|mergulho/.test(n) ? 'triceps' : 'biceps'];
  const movementPattern = patternOf(n, primaryGroup);
  const diff = plain(ex?.difficulty);
  return {
    id: idOf(name),
    name,
    primaryGroup,
    subgroups,
    primarySub: subgroups[0],
    equipment: equipmentOf(ex),
    movementPattern,
    isCompound: ['agachar', 'empurrar', 'puxar', 'dobradica'].includes(movementPattern),
    difficulty: ['iniciante', 'intermediario', 'avancado'].includes(diff) ? diff : 'iniciante',
    ref: ex
  };
}

export function normalizeLibrary(list) {
  // Mesma chave de nome (acento, parênteses, "com Halteres" x "Halter") = mesmo exercício; a primeira ocorrência vale.
  const seen = new Set();
  return (list || []).filter((e) => e?.name).map(normalizeExercise).filter((e) => { const k = catalogKey(e.name); if (!e.id || !k || seen.has(e.id) || seen.has(k)) return false; seen.add(e.id); seen.add(k); return true; });
}

/** Só o que a IA precisa para escolher: nada de imagem, descrição ou ID interno do Firestore. */
export const catalogPayload = (cands) => cands.map(({ id, name, primaryGroup, subgroups, equipment, movementPattern, isCompound, difficulty }) =>
  ({ id, name, primaryGroup, subgroups, equipment, movementPattern, isCompound, difficulty }));


// ---- restrição de equipamento pedida no texto ("somente máquina", "só halter", "sem máquina") ----
const EQUIP_WORDS = [
  ['maquina', /maquina|aparelho/],
  ['halter', /halter/],
  ['barra', /\bbarra/],
  ['polia', /polia|cabo/],
  ['livre', /peso (do )?corpo|calistenia/]
];
const EQUIP_LABEL = { maquina: 'máquina', halter: 'halter', barra: 'barra', polia: 'polia', livre: 'peso do corpo' };

/** Devolve { only: [...equipamentos], without: [...] } ou null. "somente/apenas/só X" restringe; "sem X" exclui. */
export function parseEquipmentConstraint(text) {
  const t = plain(text);
  if (!t) return null;
  const only = new Set();
  const without = new Set();
  for (const [key, re] of EQUIP_WORDS) {
    const word = re.source;
    if (new RegExp(`(somente|apenas|so|exclusivamente|unicamente)\\b(?:(?!\\bsem\\b)[^.,;!?]){0,25}(${word})`).test(t)) only.add(key);
    if (new RegExp(`\\b(sem|nada de|evitar|nao quero|nao use)\\b[^.,;!?]{0,12}(${word})`).test(t)) without.add(key);
  }
  if (only.has('maquina')) only.add('polia');   // polia/cabo é máquina de cabos
  if (!only.size && !without.size) return null;
  return { only: [...only], without: [...without] };
}

// "Máquina" inclui polias e cabos (máquinas de cabos); a descrição mostrada ao aluno diz isso para não haver surpresa.
export const describeConstraint = (c) => {
  if (!c.only.length) return `sem ${c.without.map((k) => EQUIP_LABEL[k]).join(' nem ')}`;
  const labels = c.only.filter((k, _i, a) => !(k === 'polia' && a.includes('maquina'))).map((k) => EQUIP_LABEL[k]);
  return `somente ${labels.join(' e ')}${c.only.includes('maquina') ? ' (inclui polias e cabos)' : ''}`;
};

/** Filtra a biblioteca normalizada. Para "somente máquina", nomes ambíguos ("livre ou hack") não valem. */
export function applyEquipmentConstraint(library, constraint) {
  if (!constraint) return library;
  return library.filter((e) => {
    if (constraint.without.includes(e.equipment)) return false;
    if (!constraint.only.length) return true;
    if (!constraint.only.includes(e.equipment)) return false;
    return !(e.equipment === 'maquina' && /\b(livre|halter|barra)\b/.test(plain(e.name)));
  });
}

// ---- foco (spec) ----
const LEG_FOCUS_LABEL = { completo: 'Pernas completas', quadriceps: 'Quadríceps', posterior: 'Posterior e glúteos', gluteos: 'Glúteos', panturrilhas: 'Panturrilhas' };
const GROUP_LABEL = { peito: 'peito', costas: 'costas', ombros: 'ombros', bracos: 'braços', core: 'abdômen/core' };

const legPart = (focus) => ({ group: 'pernas', focus });
const specOf = (parts) => ({ parts, mixed: parts.length > 1, label: parts.map((p) => (p.group === 'pernas' ? LEG_FOCUS_LABEL[p.focus] : p.legacy || GROUP_LABEL[p.group])).join(' + ') });

/** Foco escolhido na tela/tool -> spec. Rótulos antigos de não-perna seguem como "legacy". */
export function specFromFocus(label) {
  switch (label) {
    case 'Pernas Completo': return specOf([legPart('completo')]);
    case 'Quadríceps': return specOf([legPart('quadriceps')]);
    case 'Posterior e Glúteos': return specOf([legPart('posterior')]);
    case 'Glúteos': return specOf([legPart('gluteos')]);
    case 'Panturrilhas': return specOf([legPart('panturrilhas')]);
    case 'Pernas + Ombros': return specOf([legPart('completo'), { group: 'ombros' }]);
    case 'Peito e Tríceps': case 'Costas e Bíceps': case 'Ombros e ABS': case 'Full Body (Corpo Todo)':
      return { parts: [{ group: 'legacy', legacy: label }], mixed: false, label };
    default: return { parts: [{ group: 'legacy', legacy: 'Full Body (Corpo Todo)' }], mixed: false, label: 'Full Body (Corpo Todo)' };
  }
}

/** Interpreta o texto do aluno. Devolve null quando não reconhece nenhum grupo (a tela decide o foco). */
export function parseRequest(text) {
  const t = plain(text);
  if (!t) return null;
  if (/corpo (todo|inteiro)|full ?body/.test(t)) return specFromFocus('Full Body (Corpo Todo)');
  let leg = null;
  if (/quadric/.test(t)) leg = 'quadriceps';
  else if (/posterior|isquio|flexora/.test(t)) leg = 'posterior';
  else if (/gluteo|bumbum|glute/.test(t)) leg = 'gluteos';
  else if (/panturrilha/.test(t)) leg = 'panturrilhas';
  else if (/perna|coxa|inferior|leg day|\bleg\b/.test(t)) leg = 'completo';
  const others = [];
  if (/ombro/.test(t)) others.push('ombros');
  if (/peito|peitoral/.test(t)) others.push('peito');
  if (/costas|dorsal|\bback\b/.test(t)) others.push('costas');
  if (/braco|biceps|triceps/.test(t)) others.push('bracos');
  if (/abdomen|abdominal|\bcore\b/.test(t)) others.push('core');
  if (leg) return specOf([legPart(leg), ...others.map((g) => ({ group: g }))]);
  if (others.length === 1) {
    const legacy = { peito: 'Peito e Tríceps', costas: 'Costas e Bíceps', ombros: 'Ombros e ABS', core: 'Ombros e ABS' }[others[0]];
    return legacy ? { parts: [{ group: 'legacy', legacy }], mixed: false, label: legacy } : specOf([{ group: others[0] }]);
  }
  if (others.length > 1) return specOf(others.map((g) => ({ group: g })));
  return null;
}

/** Quantos exercícios por parte. Pedido misto com pernas: pernas ficam com 2/3 (6 -> 4 + 2). */
export function allocate(spec, total) {
  const n = spec.parts.length;
  if (n === 1) return [total];
  const hasLegs = spec.parts[0].group === 'pernas';
  const first = hasLegs ? Math.max(2, Math.round((total * 2) / 3)) : Math.ceil(total / n);
  const rest = total - first;
  const per = Math.floor(rest / (n - 1));
  const counts = [first, ...Array(n - 1).fill(per)];
  counts[n - 1] += rest - per * (n - 1);
  return counts;
}

// ---- escolha determinística ----
const SLOTS = {
  completo: ['quadriceps', 'posterior', 'gluteos', 'panturrilhas', 'adutores', 'quadriceps', 'posterior', 'gluteos', 'quadriceps'],
  quadriceps: ['quadriceps', 'quadriceps', 'quadriceps', 'posterior', 'quadriceps', 'panturrilhas', 'gluteos', 'quadriceps'],
  posterior: ['posterior', 'gluteos', 'posterior', 'gluteos', 'quadriceps', 'panturrilhas', 'posterior', 'gluteos'],
  gluteos: ['gluteos', 'gluteos', 'posterior', 'gluteos', 'quadriceps', 'adutores', 'panturrilhas', 'gluteos'],
  panturrilhas: ['panturrilhas', 'panturrilhas', 'quadriceps', 'posterior', 'gluteos', 'adutores', 'quadriceps']
};
const variant = (e) => plain(e.name).split(/[^a-z]+/)[0];
const byCompoundFirst = (a, b) => Number(b.isCompound) - Number(a.isCompound);

function pickLegs(focus, pool, count) {
  const legs = pool.filter((e) => e.primaryGroup === 'pernas');
  const picked = [];
  const bySub = {};
  legs.forEach((e) => { (bySub[e.primarySub] = bySub[e.primarySub] || []).push(e); });
  Object.values(bySub).forEach((l) => l.sort(byCompoundFirst));
  const take = (sub) => {
    const list = bySub[sub] || [];
    const used = new Map();
    picked.forEach((p) => used.set(variant(p), (used.get(variant(p)) || 0) + 1));
    const next = list.find((e) => !picked.includes(e) && (used.get(variant(e)) || 0) < 2) || list.find((e) => !picked.includes(e));
    if (next) picked.push(next);
    return !!next;
  };
  for (const sub of SLOTS[focus] || SLOTS.completo) { if (picked.length >= count) break; take(sub); }
  for (const e of legs) { if (picked.length >= count) break; if (!picked.includes(e)) picked.push(e); }
  return picked.slice(0, count);
}

function pickGroup(part, pool, count, pickLegacy) {
  if (part.group === 'pernas') return pickLegs(part.focus, pool, count);
  if (part.group === 'legacy') return pickLegacy(part.legacy, pool, count);
  const list = pool.filter((e) => e.primaryGroup === part.group).sort(byCompoundFirst);
  const picked = [];
  const used = new Map();
  for (const cap of [2, 99]) for (const e of list) {
    if (picked.length >= count) break;
    if (picked.includes(e) || (cap < 99 && (used.get(variant(e)) || 0) >= cap)) continue;
    picked.push(e); used.set(variant(e), (used.get(variant(e)) || 0) + 1);
  }
  return picked;
}

/** Seleção por rótulo antigo (Peito e Tríceps...) usando a lógica já existente, injetada para evitar dependência circular. */
let legacyPicker = (_label, pool, count) => pool.slice(0, count);
export const setLegacyPicker = (fn) => { legacyPicker = fn; };

export function composeDeterministic(spec, lib, total) {
  const counts = allocate(spec, total);
  const picks = [];
  spec.parts.forEach((part, i) => { pickGroup(part, lib, counts[i], legacyPicker).forEach((e) => { if (!picks.includes(e)) picks.push(e); }); });
  return picks;
}

/** Candidatos enviados à IA: só o que serve ao foco (nunca a biblioteca inteira). */
export function candidatesFor(spec, lib, cap = 24) {
  const out = [];
  const add = (e) => { if (!out.includes(e)) out.push(e); };
  spec.parts.forEach((part) => {
    if (part.group === 'pernas') pickLegs(part.focus, lib, 40).forEach(add);
    else if (part.group === 'legacy') legacyPicker(part.legacy, lib, 24).forEach(add);
    else pickGroup(part, lib, 12, legacyPicker).forEach(add);
  });
  return out.slice(0, cap);
}

// ---- validação de composição ----
const countWhere = (picks, fn) => picks.filter(fn).length;

/**
 * Confere se a ficha respeita o foco pedido. `expected` (grupo -> mínimo) é a divisão que a montagem determinística consegue
 * entregar com esta biblioteca; em pedido misto a ficha da IA precisa ter pelo menos isso de cada grupo.
 */
export function checkComposition(picks, spec, total, expected = null) {
  const reasons = [];
  if (!picks.length) return { ok: false, reasons: ['vazia'] };
  spec.parts.forEach((part) => {
    if (part.group === 'legacy') return;
    const mine = picks.filter((e) => e.primaryGroup === part.group);
    if (spec.mixed && expected && mine.length < (expected[part.group] || 0)) reasons.push(`divisao_${part.group}`);
    if (part.group !== 'pernas') return;
    const n = mine.length;
    if (!spec.mixed && n / picks.length < 0.7) reasons.push('pernas_abaixo_de_70');
    const q = countWhere(mine, (e) => e.primarySub === 'quadriceps');
    const pg = countWhere(mine, (e) => ['posterior', 'gluteos'].includes(e.primarySub));
    const post = countWhere(mine, (e) => e.primarySub === 'posterior');
    const glu = countWhere(mine, (e) => e.primarySub === 'gluteos');
    const cal = countWhere(mine, (e) => e.primarySub === 'panturrilhas');
    const adu = countWhere(mine, (e) => e.primarySub === 'adutores');
    switch (part.focus) {
      case 'completo':
        if (q < 1) reasons.push('sem_quadriceps');
        if (pg < 1) reasons.push('sem_posterior_ou_gluteos');
        if (n >= 5 && cal + adu < 1) reasons.push('sem_panturrilha_ou_adutores');
        break;
      case 'quadriceps': if (q < Math.ceil(n / 2)) reasons.push('quadriceps_insuficiente'); break;
      case 'posterior':
        if (pg < Math.ceil(n / 2)) reasons.push('posterior_gluteos_insuficiente');
        if (post < 1) reasons.push('sem_posterior');
        break;
      case 'gluteos': if (glu < Math.ceil(n / 2)) reasons.push('gluteos_insuficiente'); break;
      case 'panturrilhas': if (cal < 1) reasons.push('sem_panturrilha'); break;
      default: break;
    }
  });
  // fora do foco: nenhum grupo que o pedido não incluiu (core é tolerado em pedido só de pernas)
  const allowed = new Set(spec.parts.filter((p) => p.group !== 'legacy').map((p) => p.group));
  if (allowed.size && picks.some((e) => !allowed.has(e.primaryGroup) && !(allowed.has('pernas') && !spec.mixed && e.primaryGroup === 'core'))) reasons.push('grupo_fora_do_foco');
  return { ok: reasons.length === 0, reasons };
}

/** Texto curto da divisão para mostrar ao aluno (pedido misto). */
export function divisionText(spec, total, picks) {
  if (!spec.mixed) return null;
  const parts = spec.parts.map((p) => {
    const label = p.group === 'pernas' ? 'pernas' : (GROUP_LABEL[p.group] || p.legacy);
    const n = picks.filter((e) => e.primaryGroup === p.group).length;
    return `${n} de ${label}`;
  });
  return parts.join(' e ');
}

const GOAL_DEFAULTS = {
  'Força': { sets: 4, reps: '6', rest: 90 },
  Emagrecimento: { sets: 3, reps: '12-15', rest: 45 },
  'Resistência': { sets: 3, reps: '12-15', rest: 45 }
};
export const defaultsForGoal = (goal) => GOAL_DEFAULTS[goal] || { sets: 3, reps: '8-12', rest: 60 };

function extractJson(text) {
  if (text && typeof text === 'object') return text;
  const s = String(text || '');
  const start = s.indexOf('{'); const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { return null; }
}

export function buildPrompt({ spec, counts, goal, durationMinutes, catalog, references = [] }) {
  const split = spec.parts.map((p, i) => `${counts[i]} de ${p.group === 'pernas' ? `pernas (${LEG_FOCUS_LABEL[p.focus]})` : (GROUP_LABEL[p.group] || p.legacy)}`).join(' e ');
  return `Monte uma ficha de treino em português. Objetivo: ${goal}. Duração: ${durationMinutes} min. Foco obrigatório: ${spec.label}. Distribuição: ${split}.\n`
    + 'Escolha SOMENTE pelo campo "id" dos candidatos abaixo; nunca invente exercícios nem use outros grupos musculares.\n'
    + `Candidatos: ${JSON.stringify(catalog)}\n`
    + (references.length ? `Modelos oficiais de referência (apenas para inspirar a ordem): ${JSON.stringify(references)}\n` : '')
    + 'Responda só com JSON: {"name":"...","description":"curta, sem emojis","exercises":[{"id":"...","sets":3,"reps":"8-12","rest":60}]}.';
}

function prepare({ spec, library, total, goal }) {
  const lib = Array.isArray(library) && library[0]?.primarySub ? library : normalizeLibrary(library);
  const counts = allocate(spec, total);
  const candidates = candidatesFor(spec, lib);
  const need = Math.min(3, total);
  if (candidates.length < need) {
    throw new InsufficientExercisesError(`A biblioteca tem poucos exercícios para ${spec.label} (${candidates.length}). Cadastre mais exercícios desse grupo para gerar a ficha.`);
  }
  const det = composeDeterministic(spec, lib, total);
  const expected = {};
  det.forEach((e) => { expected[e.primaryGroup] = (expected[e.primaryGroup] || 0) + 1; });
  const base = defaultsForGoal(goal);
  const finish = (picks, source, extra = {}) => ({
    spec, source, ...extra,
    division: divisionText(spec, total, picks),
    // Prancha e cardio não seguem as repetições do objetivo: usam a prescrição do próprio exercício (segundos ou minutos).
    exercises: picks.map((e) => {
      const kind = exerciseKind(e.ref || e);
      if (kind === 'strength') return { ...e, sets: String(e.sets ?? base.sets), reps: String(e.reps ?? base.reps), rest: e.rest ?? base.rest };
      const own = defaultsForKind(kind);
      const refReps = parseInt(e.ref?.reps, 10);
      return { ...e, kind, sets: String(e.ref?.sets > 0 ? e.ref.sets : own.sets), reps: String(refReps > 0 ? refReps : own.reps), rest: kind === 'cardio' ? 0 : (e.ref?.rest ?? own.rest) };
    })
  });
  return { lib, counts, candidates, need, det, expected, base, finish };
}

/** Montagem sem IA (síncrona): é a ficha de reserva e sempre respeita o foco e a biblioteca. */
export function composeLocalPlan({ spec, library, total, goal }) {
  const { det, finish } = prepare({ spec, library, total, goal });
  return finish(det, 'local', { reason: 'sem_ia' });
}

/**
 * Gera a ficha. `askModel(prompt)` devolve texto/JSON da IA (ou lança erro). Qualquer falha (IA fora do ar, ID inventado, grupo errado)
 * cai na montagem determinística: o resultado é sempre válido e só usa exercícios da biblioteca.
 */
export async function generatePlan({ spec, library, total, goal, durationMinutes, askModel, references = [] }) {
  const { counts, candidates, need, det, expected, base, finish } = prepare({ spec, library, total, goal });

  if (typeof askModel === 'function') {
    try {
      const raw = await askModel(buildPrompt({ spec, counts, goal, durationMinutes, catalog: catalogPayload(candidates), references }));
      const plan = extractJson(raw);
      const byId = new Map(candidates.map((c) => [c.id, c]));
      const seen = new Set();
      const aiPicks = (plan?.exercises || []).map((item) => {
        const base2 = byId.get(String(item?.id || ''));
        if (!base2 || seen.has(base2.id)) return null; // fora da biblioteca permitida ou repetido
        seen.add(base2.id);
        return { ...base2, sets: Math.min(6, Math.max(1, Number(item.sets) || base.sets)), reps: String(item.reps || base.reps).slice(0, 20), rest: Math.min(300, Math.max(20, Number(item.rest) || base.rest)) };
      }).filter(Boolean).slice(0, total);
      const check = checkComposition(aiPicks, spec, total, expected);
      if (aiPicks.length >= need && check.ok) return finish(aiPicks, 'ia', { name: plan.name, description: plan.description });
      return finish(det, 'local', { reason: 'ia_invalida', reasons: check.reasons });
    } catch (e) {
      return finish(det, 'local', { reason: 'ia_indisponivel' });
    }
  }
  return finish(det, 'local', { reason: 'sem_ia' });
}
