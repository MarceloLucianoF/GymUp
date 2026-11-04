// Variedade do gerador de fichas: o que o aluno fez e o que a IA gerou por último, para a próxima ficha não sair igual.
// Só nomes de exercícios (nada de carga, data ou identificador) vão para o pedido à IA.

const STORE_KEY = 'bohtreinar_ai_recent_v1';
const MAX_STORED = 6;
const namesOf = (list) => (list || []).map((e) => String(e?.name || e || '').trim()).filter(Boolean);

/** Listas de exercícios dos últimos check-ins (mais recente primeiro). */
export function recentListsFromHistory(historyDocs = [], max = 4) {
  return (historyDocs || []).slice(0, max).map((c) => namesOf(c?.exercises)).filter((l) => l.length);
}

/** Exercícios mais feitos nos check-ins (contagem por nome), para a IA variar em relação a eles. */
export function frequentExercises(historyDocs = [], max = 8, window = 20) {
  const count = new Map();
  (historyDocs || []).slice(0, window).forEach((c) => namesOf(c?.exercises).forEach((n) => count.set(n, (count.get(n) || 0) + 1)));
  return [...count.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, max).map(([name]) => name);
}

const storage = () => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch (e) { return null; } };

/** Fichas geradas recentemente neste aparelho (listas de nomes, mais recente primeiro). */
export function generatedHistory() {
  try {
    const raw = JSON.parse(storage()?.getItem(STORE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(Array.isArray).map((l) => l.map(String)).slice(0, MAX_STORED) : [];
  } catch (e) { return []; }
}

/** Guarda a lista da ficha gerada (sem cardio/alongamento, que não variam por biblioteca). */
export function rememberGenerated(workout) {
  const list = namesOf(workout?.exercises);
  if (!list.length) return;
  try {
    const next = [list, ...generatedHistory().filter((l) => l.join('|') !== list.join('|'))].slice(0, MAX_STORED);
    storage()?.setItem(STORE_KEY, JSON.stringify(next));
  } catch (e) { /* armazenamento cheio ou bloqueado: a variedade só perde a memória */ }
}

/** Junta tudo no formato que o gerador recebe: { lists, frequent }. */
export function varietyContext({ historyDocs = [], extraLists = [] } = {}) {
  const lists = [...extraLists.map(namesOf), ...generatedHistory(), ...recentListsFromHistory(historyDocs)].filter((l) => l.length);
  const seen = new Set();
  const unique = lists.filter((l) => { const k = [...l].sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
  return { lists: unique.slice(0, 8), frequent: frequentExercises(historyDocs) };
}
