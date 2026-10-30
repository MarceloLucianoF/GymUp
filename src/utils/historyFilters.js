// Filtros do Histórico (puros): período, dia do calendário, ficha, exercício e busca por texto.

const norm = (s) => String(s || '').trim().toLowerCase();

/** Chave local do dia ("2026-10-29"), ou null para datas inválidas. */
export const dayKeyOf = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Identificador da ficha de uma sessão: o ID quando gravado; senão o nome. */
export const trainingKeyOf = (item) => (item?.trainingId ? `id:${item.trainingId}` : `nome:${norm(item?.trainingName)}`);

/** Fichas presentes no histórico, mais frequentes primeiro. */
export function trainingOptions(history) {
  const map = new Map();
  (history || []).forEach((h) => {
    const key = trainingKeyOf(h);
    const cur = map.get(key) || { value: key, label: h.trainingName || 'Treino sem nome', count: 0 };
    cur.count += 1;
    map.set(key, cur);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
}

/** Exercícios feitos no histórico (sem repetir por grafia), em ordem alfabética. */
export function exerciseOptions(history) {
  const map = new Map();
  (history || []).forEach((h) => (h.exercises || []).forEach((ex) => {
    const key = norm(ex?.name);
    if (!key) return;
    const cur = map.get(key) || { value: key, label: ex.name.trim(), count: 0 };
    cur.count += 1;
    map.set(key, cur);
  }));
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/**
 * Aplica os filtros. `day` (chave do dia) tem prioridade sobre o período.
 * filters: { search, time: 'all'|'month'|'last_month', day, training, exercise }
 */
export function filterHistory(history, { search = '', time = 'all', day = null, training = '', exercise = '' } = {}, now = new Date()) {
  let rows = history || [];
  if (search) {
    const term = norm(search);
    rows = rows.filter((h) => norm(h.trainingName).includes(term) || (h.exercises || []).some((ex) => norm(ex?.name).includes(term)));
  }
  if (training) rows = rows.filter((h) => trainingKeyOf(h) === training);
  if (exercise) rows = rows.filter((h) => (h.exercises || []).some((ex) => norm(ex?.name) === exercise));
  if (day) return rows.filter((h) => dayKeyOf(h.date) === day);
  if (time === 'month' || time === 'last_month') {
    const ref = time === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    rows = rows.filter((h) => {
      const d = new Date(h.date);
      return !Number.isNaN(d.getTime()) && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
    });
  }
  return rows;
}
