// Normalizador único do catálogo de exercícios. A biblioteca vem de duas fontes (a embutida no app e a coleção `exercises` do
// Firestore) com rótulos diferentes para o mesmo conceito: grupo ("braços" x "bíceps"/"tríceps"), dificuldade ("avancado" x
// "avançado"), repetições (número x texto) e nomes ("Halter" x "com Halteres"). Aqui cada exercício vira UMA forma só, e a
// auditoria usa a mesma forma para apontar o que está inconsistente. Nada aqui grava dados.
import { equipmentOptions } from './equipment';
import { exerciseKind } from './exerciseKind';

const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const GROUPS = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'pernas', 'gluteos', 'panturrilha', 'core', 'cardio', 'mobilidade'];
export const GROUP_LABELS = { peito: 'Peito', costas: 'Costas', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps', pernas: 'Pernas', gluteos: 'Glúteos', panturrilha: 'Panturrilha', core: 'Core', cardio: 'Cardio', mobilidade: 'Alongamento e mobilidade' };
export const DIFFICULTIES = ['iniciante', 'intermediario', 'avancado'];
/** Como a dificuldade é GRAVADA (a mesma do editor do treinador); a comparação em código ignora acento e caixa. */
export const STORED_DIFFICULTY = { iniciante: 'iniciante', intermediario: 'intermediário', avancado: 'avançado' };
export const DIFFICULTY_LABELS = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };

/** Grupo do catálogo. "braços" (rótulo antigo) é resolvido pelo nome: bíceps ou tríceps. */
export function catalogGroup(ex) {
  const g = plain(ex?.muscleGroup || ex?.category);
  const n = plain(ex?.name);
  if (/cardio|aerobi/.test(g)) return 'cardio';
  if (/mobilidade|alongament|aquecimento/.test(g)) return 'mobilidade';
  if (/peit/.test(g)) return 'peito';
  if (/costa|dorsal|trapez|lombar/.test(g)) return 'costas';
  if (/ombro|deltoid/.test(g)) return 'ombros';
  if (/^biceps/.test(g)) return 'biceps';
  if (/^triceps/.test(g)) return 'triceps';
  if (/braco|antebraco/.test(g)) return /triceps|francesa|mergulho|testa|pushdown/.test(n) ? 'triceps' : 'biceps';
  if (/gluteo/.test(g)) return 'gluteos';
  if (/panturrilha/.test(g)) return 'panturrilha';
  if (/perna|quadric|posterior|coxa|adutor|abdutor|inferior/.test(g)) {
    if (/hip thrust|pelvica|gluteo|glute|abdutora/.test(n)) return 'gluteos';
    if (/panturrilha/.test(n)) return 'panturrilha';
    return 'pernas';
  }
  if (/core|abdom/.test(g)) return 'core';
  return g || 'geral';
}

export function canonicalDifficulty(value) {
  const d = plain(value);
  return DIFFICULTIES.includes(d) ? d : null;
}

// ---- chave de nome: duas formas de escrever o mesmo exercício dão a mesma chave ----
const STOP = new Set(['com', 'na', 'no', 'de', 'do', 'da', 'em', 'e', 'a', 'o', 'ao']);
const tokens = (name) => plain(name).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t))
  .map((t) => (t === 'halteres' ? 'halter' : t === 'barras' ? 'barra' : t === 'maquinas' ? 'maquina' : t));

/** Igualdade exata depois de tirar acento, parênteses, preposições e plural de halter. Usada para juntar fontes sem risco. */
export const catalogKey = (name) => tokens(name).join(' ');

// Para a auditoria apenas: palavras que não mudam o exercício na prática ("Supino Reto Máquina" = "Supino Máquina").
const NOISE = new Set(['reto', 'reta', 'livre', 'aparelho']);
const EQUIP_TOKENS = new Set(['maquina', 'halter', 'barra', 'polia', 'cabo', 'corda']);
export const similarityTokens = (name) => tokens(name).filter((t) => !NOISE.has(t) && !EQUIP_TOKENS.has(t));
const TOO_GENERIC = new Set(['triceps', 'biceps', 'abdominal', 'rosca', 'remada', 'puxada', 'elevacao', 'agachamento', 'desenvolvimento']);
export const nearKey = (name) => similarityTokens(name).sort().join(' ');

/** Forma única de um exercício, venha de onde vier. */
export function normalizeCatalogEntry(raw, source = 'desconhecida') {
  const name = String(raw?.name || '').trim();
  const reps = raw?.reps;
  const equipmentExplicit = Array.isArray(raw?.equipment) ? raw.equipment.length > 0 : !!raw?.equipment;
  return {
    source,
    id: raw?.id || raw?.firestoreId || null,
    name,
    key: catalogKey(name),
    group: catalogGroup(raw),
    rawGroup: raw?.muscleGroup || raw?.category || '',
    kind: exerciseKind(raw),
    equipment: equipmentOptions(raw),
    equipmentExplicit,
    difficulty: canonicalDifficulty(raw?.difficulty),
    rawDifficulty: raw?.difficulty ?? '',
    sets: Number(raw?.sets) || 0,
    reps: typeof reps === 'number' ? reps : parseInt(String(reps ?? ''), 10) || 0,
    repsType: typeof reps,
    rest: Number(raw?.rest) || 0,
    hasImage: !!(raw?.machineImage || raw?.demoUrl),
    hasVideo: !!raw?.videoUrl,
    hasDescription: String(raw?.description || '').trim().length > 30,
    hasExecution: String(raw?.execution || '').trim().length > 60,
    approxMedia: !!raw?.mediaApprox
  };
}

/** Junta as fontes sem repetir o mesmo nome (chave igual). A embutida vence; o Firestore só acrescenta o que não existe. */
export function mergeCatalogs(embedded = [], remote = []) {
  const byKey = new Map();
  [...embedded.map((e) => normalizeCatalogEntry(e, 'embutida')), ...remote.map((e) => normalizeCatalogEntry(e, 'firestore'))].forEach((e) => {
    if (!e.key) return;
    const have = byKey.get(e.key);
    if (!have) byKey.set(e.key, { ...e, sources: [e.source] });
    else have.sources.push(e.source);
  });
  return [...byKey.values()];
}

/** Auditoria: devolve { issues: [{level, code, name, detail}], totals }. level: erro (quebra o uso) | aviso | info. */
export function auditCatalog(embedded = [], remote = []) {
  const issues = [];
  const add = (level, code, e, detail = '') => issues.push({ level, code, name: e.name, source: e.sources ? e.sources.join('+') : e.source, detail });
  const merged = mergeCatalogs(embedded, remote);

  // por fonte: o que cada uma tem de errado
  [...embedded.map((e) => normalizeCatalogEntry(e, 'embutida')), ...remote.map((e) => normalizeCatalogEntry(e, 'firestore'))].forEach((e) => {
    if (!e.name) return add('erro', 'sem-nome', e);
    if (e.reps <= 0) add('erro', 'repeticoes-zero', e, `reps ${e.reps} (${e.kind})`);
    if (e.kind === 'strength' && e.sets <= 0) add('erro', 'sem-series', e);
    if (!e.hasImage) add('aviso', 'sem-imagem', e);
    if (!e.hasDescription) add('aviso', 'sem-descricao', e);
    if (!e.hasExecution) add('aviso', 'sem-execucao', e);
    if (!e.difficulty) add('aviso', 'dificuldade-invalida', e, `valor "${e.rawDifficulty}"`);
    else if (String(e.rawDifficulty) !== STORED_DIFFICULTY[e.difficulty]) add('info', 'dificuldade-fora-do-padrao', e, `"${e.rawDifficulty}" (padrão: ${STORED_DIFFICULTY[e.difficulty]})`);
    if (e.group === 'geral' || !GROUPS.includes(e.group)) add('erro', 'grupo-desconhecido', e, `"${e.rawGroup}"`);
    if (/^braco/.test(plainGroup(e.rawGroup))) add('info', 'grupo-generico', e, `"${e.rawGroup}" (rótulo do editor do treinador) -> ${e.group}`);
    if (e.source === 'firestore' && e.repsType === 'string') add('info', 'reps-em-texto', e, `"${e.reps}"`);
    if (!e.equipmentExplicit) add('info', 'equipamento-deduzido', e, e.equipment.join('|'));
    if (e.approxMedia) add('aviso', 'midia-aproximada', e);
    if (!e.hasVideo) add('info', 'sem-video', e);
  });

  // entre exercícios do catálogo final
  // Possível duplicata: mesmas palavras de identificação (sem "reto", "livre"...) e mesma família de equipamento (máquina e polia
  // contam como aparelho). Nomes de uma palavra só ("Tríceps ...") são genéricos demais para comparar.
  const family = (e) => (['maquina', 'polia'].includes(e.equipment[0]) ? 'aparelho' : e.equipment[0]);
  const byNear = new Map();
  merged.forEach((e) => { const k = nearKey(e.name); if (!k || (k.split(' ').length < 2 && TOO_GENERIC.has(k))) return; const kk = `${k}|${family(e)}`; byNear.set(kk, [...(byNear.get(kk) || []), e]); });
  byNear.forEach((list) => {
    if (list.length > 1) issues.push({ level: 'aviso', code: 'possivel-duplicata', name: list.map((e) => e.name).join('  ~  '), source: list.map((e) => e.sources.join('+')).join(' / '), detail: `grupos ${[...new Set(list.map((e) => e.group))].join('/')}` });
  });
  merged.filter((e) => e.sources.length > 1).forEach((e) => {
    // mesmo nome nas duas fontes mas com dados diferentes
    const a = embedded.map((x) => normalizeCatalogEntry(x, 'embutida')).find((x) => x.key === e.key);
    const b = remote.map((x) => normalizeCatalogEntry(x, 'firestore')).find((x) => x.key === e.key);
    if (a && b && (a.group !== b.group || a.difficulty !== b.difficulty)) issues.push({ level: 'aviso', code: 'fontes-divergem', name: e.name, source: 'embutida x firestore', detail: `grupo ${a.group}/${b.group}; dificuldade ${a.difficulty}/${b.difficulty}` });
  });

  const count = (f) => merged.reduce((o, e) => { const k = f(e); o[k] = (o[k] || 0) + 1; return o; }, {});
  return {
    issues,
    totals: {
      embutidos: embedded.length, firestore: remote.length, unicos: merged.length,
      soNoFirestore: merged.filter((e) => e.sources.length === 1 && e.sources[0] === 'firestore').length,
      emAmbas: merged.filter((e) => e.sources.length > 1).length,
      porGrupo: count((e) => e.group), porEquipamento: count((e) => e.equipment[0]), porTipo: count((e) => e.kind), porDificuldade: count((e) => e.difficulty || 'invalida')
    },
    merged
  };
}

function plainGroup(v) { return plain(v); }

const TITLE_GROUPS = [['costas', /costas|dorsal/], ['peito', /peito|peitoral/], ['pernas', /perna|inferior|quadriceps|gluteo/], ['ombros', /ombro/], ['biceps', /biceps/], ['triceps', /triceps/]];

/**
 * Auditoria das fichas: itens que apontam para exercício inexistente ou de demonstração, itens sem imagem e título que não
 * combina com o conteúdo ("TREINO COSTAS" com exercícios de peito). `catalog` é a lista final de mergeCatalogs.
 */
export function auditTrainings(trainings = [], catalog = [], remote = []) {
  const issues = [];
  const byKey = new Map(catalog.map((e) => [e.key, e]));
  const remoteById = new Map(remote.map((e) => [e.id || e.firestoreId, e]));
  (trainings || []).forEach((t) => {
    const items = Array.isArray(t.exercises) ? t.exercises : [];
    const add = (level, code, detail) => issues.push({ level, code, name: t.name || '(sem nome)', detail });
    let unresolved = 0; let noImage = 0; let demo = 0; const groups = {};
    items.forEach((x) => {
      const id = typeof x === 'string' ? x : (x?.firestoreId || x?.exerciseId || x?.id || '');
      const ref = remoteById.get(id);
      const name = typeof x === 'object' ? x?.name : ref?.name;
      const entry = byKey.get(catalogKey(name || ''));
      if (/^demo_/.test(id)) demo += 1;
      if (!ref && !entry) unresolved += 1;
      const hasImage = (typeof x === 'object' && (x?.machineImage || x?.demoUrl)) || ref?.machineImage || entry?.hasImage;
      if (!hasImage) noImage += 1;
      const g = entry?.group || (ref ? catalogGroup(ref) : null);
      if (g) groups[g] = (groups[g] || 0) + 1;
    });
    if (!items.length) add('erro', 'ficha-vazia', '');
    if (demo) add('aviso', 'ficha-demonstracao', `${demo} de ${items.length} itens com id demo_*`);
    if (unresolved) add('aviso', 'exercicio-fora-do-catalogo', `${unresolved} de ${items.length} sem correspondência no catálogo`);
    if (noImage) add('aviso', 'exercicio-sem-imagem', `${noImage} de ${items.length}`);
    const title = plain(t.name);
    const wanted = TITLE_GROUPS.filter(([, re]) => re.test(title)).map(([g]) => g);
    const total = Object.values(groups).reduce((a, b) => a + b, 0);
    if (wanted.length && total >= 3) {
      // "pernas" cobre glúteos e panturrilha; bíceps e tríceps contam juntos ("braços")
      const allowed = new Set(wanted.flatMap((g) => (g === 'pernas' ? ['pernas', 'gluteos', 'panturrilha'] : g === 'biceps' || g === 'triceps' ? ['biceps', 'triceps'] : [g])));
      const inTitle = [...allowed].reduce((acc, g) => acc + (groups[g] || 0), 0);
      if (inTitle / total < 0.5) add('aviso', 'titulo-incoerente', `título fala de ${wanted.join(' e ')}, mas só ${inTitle} de ${total} exercícios são desse(s) grupo(s) (${Object.entries(groups).map(([g, n]) => `${g} ${n}`).join(', ')})`);
    }
  });
  return issues;
}
