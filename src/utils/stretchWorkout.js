// Pedido de alongamento, mobilidade ou aquecimento: a ficha vem dos exercícios do grupo "mobilidade" da biblioteca, em séries de segundos.
// "Mobilidade de ombro/quadril/coluna/tornozelo/punho" monta uma sequência da região; sem região, uma sequência de corpo inteiro.
// buildWarmupStretch dá a sequência curta de "alongamento geral antes do treino" usada nos editores de treino.
import { catalogGroup } from './exerciseCatalog';

const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const isStretchRequest = (text) => /alongament|mobilidade|aquecimento|soltar o corpo/.test(plain(text));

// Regiões que o aluno pode pedir: palavra do pedido -> região; região -> exercícios (pelo nome).
const REGION_WORDS = [
  [/ombro|escapula|manguito/, 'ombros'],
  [/quadril|gluteo|virilha|adutor/, 'quadril'],
  [/coluna|costas|lombar|toracic|postura|pescoco/, 'coluna'],
  [/tornozelo|panturrilha|perna|joelho/, 'pernas'],
  [/punho|antebraco/, 'punhos']
];
const REGIONS = {
  ombros: { title: 'Mobilidade de ombros', match: /ombro|escapula|cotovelo|wall slide|peit|dorsal|costas altas|triceps|bastao|bracos/ },
  quadril: { title: 'Mobilidade de quadril', match: /quadril|gluteo|piriforme|flexor|adutor|virilha|corredor|mundo|posterior/ },
  coluna: { title: 'Mobilidade de coluna', match: /toracic|tronco|gato|crianca|lombar|pelvica|costas altas|dorsal|mundo|inchworm|pescoco/ },
  pernas: { title: 'Mobilidade de pernas e tornozelos', match: /tornozelo|panturrilha|posterior|quadriceps|corredor|adutor|virilha|flexor/ },
  punhos: { title: 'Mobilidade de punhos e antebraços', match: /punho|antebraco|cotovelo/ }
};

/** Região pedida ("mobilidade de ombro" -> 'ombros'); null quando é geral ou não diz. */
export function stretchRegion(text) {
  const t = plain(text);
  if (/geral|corpo (todo|inteiro)|completo/.test(t)) return null;
  const hit = REGION_WORDS.find(([re]) => re.test(t));
  return hit ? hit[1] : null;
}

/**
 * O pedido é de alongamento/mobilidade mesmo citando um músculo? "mobilidade de ombro", "alongamento para lombar" sim;
 * "treino de peito com aquecimento" não (vale o treino de força).
 */
export const isFocusedStretchRequest = (text) => {
  const t = plain(text);
  return /(alongament\w*|mobilidade)\s+(?:(?:de|do|da|dos|das|para|pra|pro|no|na|nos|nas|em)\s+)?(?:(?:o|a|os|as)\s+)?(ombro|escapula|quadril|gluteo|coluna|costas|lombar|toracic|tornozelo|punho|antebraco|perna|pescoco|virilha|geral|corpo)/.test(t)
    || /^(?:(?:monte|quero|faca|me de|preciso de)\s+)?(?:(?:um|uma)\s+)?(?:treino|sequencia|sessao|rotina)?\s*(?:de\s+)?(alongament|mobilidade)/.test(t.trim());
};

// Dinâmicos (aquecem) antes dos estáticos (seguram a posição).
const DYNAMIC = /aquecimento|circulos|rolar|dinamica|rotacao|deslizamento|deslocamento|inchworm|moinho|mundo|mobilidade|cotovelos para tras/;
const isDynamic = (e) => DYNAMIC.test(plain(e.name));

// Sessão de corpo inteiro: um exercício por "vaga", na ordem de uma aula; o que sobrar entra depois.
const GENERAL_SLOTS = [/circulos com os bracos/, /circulos de quadril em pe/, /toracica em pe/, /gato/, /maior alongamento do mundo/, /posterior de coxa|posterior em pe/, /flexor do quadril/, /peitoral|peito e ombro/, /lateral de tronco/, /crianca/];
// Antes do treino: curto e mais dinâmico (cerca de 5 minutos).
const WARMUP_SLOTS = [/alongamento de corpo inteiro/, /circulos com os bracos/, /circulos de quadril em pe/, /toracica em pe/, /maior alongamento do mundo/, /lateral de tronco/];
const ORDER = [/aquecimento/, /gato|crianca/, /flexor|posterior|quadriceps|panturrilha|quadril/, /peitoral|ombro|triceps|bracos/];
const rank = (name) => { const i = ORDER.findIndex((re) => re.test(plain(name))); return i < 0 ? ORDER.length : i; };

const mobilityPool = (library) => {
  const seen = new Set();
  return library.filter((e) => {
    if (!e?.name || catalogGroup(e) !== 'mobilidade') return false;
    const k = plain(e.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const fillSlots = (pool, slots, max) => {
  const picked = [];
  slots.forEach((re) => { const e = pool.find((x) => !picked.includes(x) && re.test(plain(x.name))); if (e && picked.length < max) picked.push(e); });
  [...pool].sort((a, b) => rank(a.name) - rank(b.name)).forEach((e) => { if (picked.length < max && !picked.includes(e)) picked.push(e); });
  return picked;
};

const toItem = (e, i, overrides = {}) => ({
  firestoreId: e.firestoreId || e.id || `stretch-${i}`, name: e.name, muscleGroup: 'Alongamento e mobilidade', kind: 'timed',
  sets: String(e.sets > 0 ? e.sets : 2), reps: String(e.reps > 0 ? e.reps : 30), rest: e.rest ?? 15,
  machineImage: e.machineImage || e.demoUrl || null, videoUrl: e.videoUrl || null, description: e.description || 'Segure a posição pelo tempo indicado.',
  ...overrides
});

export function buildStretchWorkout(library = [], request = '') {
  const pool = mobilityPool(library);
  if (pool.length < 4) return null;
  const region = stretchRegion(request);
  let picked;
  if (region) {
    const own = pool.filter((e) => REGIONS[region].match.test(plain(e.name)));
    // dinâmicos primeiro; se a região tiver poucos, completa com aquecimentos gerais
    const dyn = own.filter(isDynamic);
    const still = own.filter((e) => !isDynamic(e)).slice(0, 3);
    picked = [...dyn.slice(0, 8 - still.length), ...still];
    if (picked.length < 5) picked = [...fillSlots(pool.filter((e) => !picked.includes(e)), GENERAL_SLOTS.slice(0, 3), 5 - picked.length), ...picked];
  } else {
    picked = fillSlots(pool, GENERAL_SLOTS, 8);
  }
  const exercises = picked.map((e, i) => toItem(e, i));
  const title = region ? REGIONS[region].title : 'Alongamento e mobilidade';
  return {
    name: title, category: 'Mobilidade',
    description: region ? `${title}: aquecimentos primeiro, depois alongamentos. Faça sem dor, respirando fundo.` : 'Sequência de alongamentos e aquecimentos de corpo inteiro. Segure cada posição sem dor, respirando fundo.',
    estimatedTime: `${Math.max(10, exercises.length * 2)} min`, exercises, createdAt: new Date().toISOString(), isAIGenerated: true,
    composition: { focus: 'Mobilidade', requestedFocus: title, source: 'regras', division: null, region: region || 'geral', reason: null }
  };
}

/**
 * Alongamento geral antes do treino: 5 a 6 exercícios por tempo da biblioteca, 1 série cada (cerca de 5 minutos).
 * Devolve os exercícios da biblioteca (com sets/reps/rest da sequência curta); cada editor converte para o seu formato.
 */
export function buildWarmupStretch(library = []) {
  const pool = mobilityPool(library);
  if (pool.length < 5) return [];
  const picked = [];
  WARMUP_SLOTS.forEach((re) => { const e = pool.find((x) => !picked.includes(x) && re.test(plain(x.name))); if (e) picked.push(e); });
  pool.filter(isDynamic).forEach((e) => { if (picked.length < 6 && !picked.includes(e)) picked.push(e); });
  pool.forEach((e) => { if (picked.length < 5 && !picked.includes(e)) picked.push(e); });
  return picked.slice(0, 6).map((e) => ({ ...e, kind: 'timed', sets: 1, reps: e.reps > 0 ? e.reps : 30, rest: 10 }));
}

/** O treino já começa com o alongamento geral (para não inserir duas vezes)? */
export const startsWithWarmup = (names = [], warmup = []) => warmup.length > 0 && warmup.every((w, i) => plain(names[i]) === plain(w.name));

/**
 * Etapa "Alongamento geral" na execução: só quando a ficha pede (`warmupStretch: true`) e ainda não começa
 * com o alongamento (inserido pelo botão dos editores, que pode ter usado outra biblioteca: por isso várias sequências
 * candidatas e, além delas, os 3 primeiros exercícios serem todos do alongamento também conta como "já tem").
 */
export function needsWarmupStep(workout, candidates = []) {
  if (workout?.warmupStretch !== true) return false;
  const lists = candidates.filter((w) => Array.isArray(w) && w.length > 0);
  if (!lists.length) return false;
  const names = (workout.exercises || []).map((e) => e?.name);
  if (lists.some((w) => startsWithWarmup(names, w))) return false;
  const known = new Set(lists.flat().map((w) => plain(w.name)));
  const head = names.slice(0, 3);
  return !(head.length === 3 && head.every((n) => known.has(plain(n))));
}
