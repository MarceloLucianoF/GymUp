// Montagem por "vagas" do guia de treino: cada grupo grande tem regiões/padrões (peito superior, puxada vertical, remada...)
// e a ficha preenche as vagas na ordem do guia, para costas não virar três remadas iguais nem peito só supino reto.
// Funções puras (sem Firebase): usadas pelo gerador local, pelos candidatos da IA e pela validação da resposta da IA.

const plain = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Região/padrão do exercício dentro do grupo, pelo nome. */
export function subOf(group, name) {
  const n = plain(name);
  if (group === 'peito') {
    if (/inclinad/.test(n)) return 'superior';
    if (/declinad|mergulho|crossover (alto|de cima)|de cima para baixo/.test(n)) return 'inferior';
    if (/crucifixo|crossover|peck|voador|\bfly\b/.test(n)) return 'isolador';
    return 'medio';
  }
  if (group === 'costas') {
    if (/puxada|barra fixa|pulldown|chin/.test(n)) return 'vertical';
    if (/pullover|crucifixo inverso|face pull/.test(n)) return 'isolador';
    if (/lombar|superman|terra|good morning|bom dia/.test(n)) return 'lombar';
    return 'remada';
  }
  if (group === 'ombros') {
    if (/encolhimento/.test(n)) return 'trapezio';
    if (/crucifixo inverso|face pull|posterior/.test(n)) return 'posterior';
    if (/elevacao lateral|remada alta/.test(n)) return 'lateral';
    return 'anterior';
  }
  return group;
}

// Ordem das vagas por ênfase. As primeiras vagas cobrem os mínimos do guia (costas: 1 vertical + 2 remadas + 1 isolador;
// peito: 1 reto + 1 inclinado + 1 crucifixo); as seguintes reforçam a região pedida.
const PLANS = {
  peito: {
    padrao: ['medio', 'superior', 'isolador', 'superior', 'inferior', 'isolador', 'medio'],
    superior: ['superior', 'medio', 'isolador', 'superior', 'superior', 'isolador', 'inferior'],
    medio: ['medio', 'superior', 'isolador', 'medio', 'isolador', 'inferior', 'superior'],
    inferior: ['inferior', 'medio', 'superior', 'isolador', 'inferior', 'isolador', 'medio']
  },
  costas: {
    padrao: ['vertical', 'remada', 'remada', 'isolador', 'vertical', 'remada', 'lombar'],
    largura: ['vertical', 'remada', 'remada', 'isolador', 'vertical', 'vertical', 'lombar'],
    espessura: ['vertical', 'remada', 'remada', 'isolador', 'remada', 'remada', 'lombar']
  },
  ombros: {
    padrao: ['anterior', 'lateral', 'posterior', 'lateral', 'trapezio', 'anterior'],
    lateral: ['anterior', 'lateral', 'lateral', 'posterior', 'lateral', 'trapezio'],
    posterior: ['anterior', 'posterior', 'lateral', 'posterior', 'trapezio', 'lateral'],
    anterior: ['anterior', 'lateral', 'anterior', 'posterior', 'trapezio']
  }
};

/** Ênfases aceitas (chips do "Personalizar" e parâmetro da ferramenta gerar_treino). */
export const EMPHASIS = {
  peito_superior: { group: 'peito', plan: 'superior', label: 'Peito superior (inclinado)' },
  peito_medio: { group: 'peito', plan: 'medio', label: 'Peito médio (reto)' },
  peito_inferior: { group: 'peito', plan: 'inferior', label: 'Peito inferior (declinado/crossover de cima para baixo)' },
  costas_largura: { group: 'costas', plan: 'largura', label: 'Costas: largura (puxadas)' },
  costas_espessura: { group: 'costas', plan: 'espessura', label: 'Costas: espessura (remadas)' },
  ombro_anterior: { group: 'ombros', plan: 'anterior', label: 'Deltoide anterior' },
  ombro_lateral: { group: 'ombros', plan: 'lateral', label: 'Deltoide lateral' },
  ombro_posterior: { group: 'ombros', plan: 'posterior', label: 'Deltoide posterior' },
  quadriceps: { group: 'pernas', leg: 'Quadríceps', label: 'Quadríceps' },
  posterior: { group: 'pernas', leg: 'Posterior e Glúteos', label: 'Posterior de coxa' },
  gluteos: { group: 'pernas', leg: 'Glúteos', label: 'Glúteos' }
};

/** Ênfase escrita no texto livre ("quero focar no peito superior", "costas mais largas"). */
export function parseEmphasis(text) {
  const t = plain(text);
  if (!t) return null;
  if (/peito (superior|de cima|alto)|parte (de cima|superior) do peito|peitoral superior|clavicular/.test(t)) return 'peito_superior';
  if (/peito (inferior|de baixo|baixo)|parte (de baixo|inferior) do peito|peitoral inferior/.test(t)) return 'peito_inferior';
  if (/peito (medio|do meio)|peitoral medio/.test(t)) return 'peito_medio';
  if (/costas (mais )?larg|largura (das|de) costas|dorsal larg|\bem v\b/.test(t)) return 'costas_largura';
  if (/espessura|costas (mais )?(grossa|densa)|densidade/.test(t)) return 'costas_espessura';
  if (/deltoide lateral|ombro lateral|ombros? (mais )?larg/.test(t)) return 'ombro_lateral';
  if (/deltoide posterior|ombro posterior|posterior de ombro/.test(t)) return 'ombro_posterior';
  if (/deltoide anterior|ombro anterior|ombro da frente/.test(t)) return 'ombro_anterior';
  return null;
}

/** "Quero 8 exercícios" -> 8 (de 4 a 10). */
export function parseExerciseCount(text) {
  const m = plain(text).match(/\b(\d{1,2})\s*exercicios?\b/);
  const n = m ? Number(m[1]) : 0;
  return n >= 4 && n <= 10 ? n : null;
}

const COMPOUND = /supino|chest press|flexao de braco|mergulho|remada|puxada|barra fixa|pulldown|chin|desenvolvimento|levantamento|terra|agachamento|leg press|hack|afundo|stiff/;
export const isCompoundName = (name) => COMPOUND.test(plain(name));
// Duas primeiras palavras: "Remada Curvada" e "Remada Máquina" contam como variações diferentes; "Supino Inclinado" x3 não.
const variantOf = (name) => plain(name).split(/[^a-z]+/).filter(Boolean).slice(0, 2).join(' ');

/**
 * Escolhe `count` exercícios de UM grupo (o pool já vem filtrado) preenchendo as vagas do guia na ordem da ênfase.
 * Saída: compostos antes dos isoladores, mantendo a ordem das vagas.
 */
export function pickBySlots(pool, group, count, { emphasis } = {}) {
  const plans = PLANS[group];
  if (!plans || count <= 0) return [];
  const emph = EMPHASIS[emphasis];
  const plan = (emph && emph.group === group && plans[emph.plan]) || plans.padrao;
  const seen = new Set();
  const unique = pool.filter((e) => { const k = plain(e?.name); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  const ranked = [...unique].sort((a, b) => Number(isCompoundName(b.name)) - Number(isCompoundName(a.name)));
  const picked = [];
  const used = new Map();
  const add = (e) => { picked.push(e); used.set(variantOf(e.name), (used.get(variantOf(e.name)) || 0) + 1); };
  for (const slot of plan) {
    if (picked.length >= count) break;
    const options = ranked.filter((e) => !picked.includes(e) && subOf(group, e.name) === slot);
    const next = options.find((e) => (used.get(variantOf(e.name)) || 0) < 2) || options[0];
    if (next) add(next);
  }
  // Vagas sem opção na biblioteca (ou ficha maior que o plano): completa com o restante do grupo, sem repetir variação demais.
  for (const cap of [2, 99]) for (const e of ranked) {
    if (picked.length >= count) break;
    if (!picked.includes(e) && (used.get(variantOf(e.name)) || 0) < cap) add(e);
  }
  return picked.map((e, i) => ({ e, i })).sort((a, b) => Number(isCompoundName(b.e.name)) - Number(isCompoundName(a.e.name)) || a.i - b.i).map(({ e }) => e);
}

// Mínimos do guia por grupo (só cobrados em dia daquele grupo e quando a montagem local conseguiu cumprir com esta biblioteca).
const MINIMUMS = { costas: { vertical: 1, remada: 2, isolador: 1 }, peito: { superior: 1, medio: 1, isolador: 1 } };

/**
 * Confere a ficha da IA contra a montagem local (`reference`): mesmos mínimos do guia em peito e costas e no máximo
 * 1 exercício a menos do grupo principal. Itens normalizados (`primaryGroup`, `name`). Devolve a lista de motivos.
 */
export function guideReasons(picks, reference) {
  const reasons = [];
  Object.entries(MINIMUMS).forEach(([group, mins]) => {
    const ref = reference.filter((e) => e.primaryGroup === group);
    if (ref.length < 3) return;   // corpo todo ou grupo secundário: um exercício só não tem "mínimo" de regiões
    const mine = picks.filter((e) => e.primaryGroup === group);
    if (mine.length < ref.length - 1) reasons.push(`volume_${group}`);
    Object.entries(mins).forEach(([sub, min]) => {
      const need = Math.min(min, ref.filter((e) => subOf(group, e.name) === sub).length);
      if (mine.filter((e) => subOf(group, e.name) === sub).length < need) reasons.push(`minimo_${group}_${sub}`);
    });
  });
  return reasons;
}

/** Termos digitados em "Evitar"/"Incluir" ("supino reto, agachamento livre") -> lista normalizada. */
export const termsOf = (text) => String(text || '').toLowerCase().split(/[,;\n/]|\be\b/).map(plain).map((t) => t.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 3).slice(0, 6);
export const matchesTerm = (name, terms) => { const n = plain(name); return terms.some((t) => n.includes(t)); };
