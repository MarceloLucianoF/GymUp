// Próxima ficha por rotação: determinística, só com dados do próprio aluno (fichas disponíveis, ficha atribuída e histórico
// de treinos concluídos). A IA, quando usada, só reescreve este resultado; a decisão nunca depende dela.
import { dayKey } from './consistency';

const INACTIVE = ['archived', 'paused', 'arquivada', 'arquivado', 'pausada', 'pausado'];
export const isInactive = (t) => !t || t.archived === true || t.paused === true || INACTIVE.includes(String(t.status || '').toLowerCase());

const idOf = (t) => t.firestoreId || t.id;
const LETTER = /^\s*Treino\s+([A-Z])\b/i;
const byOrderThenName = (a, b) => (Number(a.order ?? 1e9) - Number(b.order ?? 1e9)) || String(a.name).localeCompare(String(b.name), 'pt-BR');

/**
 * Fichas que giram juntas: o programa da ficha atribuída (`packageId`, na ordem definida) ou, sem programa, as fichas "Treino A, B, C…"
 * do mesmo treinador. Ficha avulsa gira sozinha. Arquivadas e pausadas ficam de fora.
 */
export function rotationGroup(trainings, assigned) {
  const pool = trainings.filter((t) => !isInactive(t));
  if (!assigned || isInactive(assigned)) return [];
  if (assigned.packageId) return pool.filter((t) => t.packageId === assigned.packageId).sort(byOrderThenName);
  const owner = assigned.coachId || assigned.createdBy;
  if (owner && LETTER.test(assigned.name || '')) {
    const sameOwner = pool.filter((t) => (t.coachId || t.createdBy) === owner && LETTER.test(t.name || ''));
    return sameOwner.sort((a, b) => LETTER.exec(a.name)[1].toUpperCase().localeCompare(LETTER.exec(b.name)[1].toUpperCase()));
  }
  return [assigned];
}

const daysBetween = (from, to) => {
  const a = new Date(`${dayKey(from)}T12:00:00`);
  const b = new Date(`${dayKey(to)}T12:00:00`);
  return Math.round((b - a) / 86_400_000);
};
export const whenLabel = (days) => (days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`);

const toDate = (v) => { const d = v?.toDate ? v.toDate() : new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

/**
 * { training, source, last, position, total, reason, goal } ou { training: null }.
 * source: assigned (ficha atribuída, sem outra para girar) | sequence (a seguinte do programa) | first (nada concluído ainda) | fallback.
 */
export function suggestNext({ trainings = [], assignedId = null, history = [], weeklyGoal = 0, weekCount = 0, trainedToday = false, now = new Date() }) {
  const pool = trainings.filter((t) => !isInactive(t));
  if (pool.length === 0) return { training: null };
  const assigned = assignedId ? pool.find((t) => idOf(t) === assignedId) : null;
  const done = history
    .map((h) => ({ id: h.trainingId, name: h.trainingName, date: toDate(h.date) }))
    .filter((h) => h.id && h.date && h.date <= now)
    .sort((a, b) => b.date - a.date);                       // só treinos concluídos (check-ins) e já ocorridos

  const goal = { weeklyGoal, weekCount, remaining: Math.max(0, weeklyGoal - weekCount), met: weeklyGoal > 0 && weekCount >= weeklyGoal };
  const base = { goal, trainedToday };

  let group = assigned ? rotationGroup(pool, assigned) : [];
  let source;
  if (group.length === 0) {                                  // sem ficha atribuída: gira por todas as disponíveis
    group = [...pool].sort(byOrderThenName);
    source = 'fallback';
  }
  const ids = group.map(idOf);
  const lastDone = done.find((h) => ids.includes(h.id));
  const last = lastDone ? { id: lastDone.id, name: group.find((t) => idOf(t) === lastDone.id)?.name || lastDone.name, date: lastDone.date, daysAgo: daysBetween(lastDone.date, now) } : null;

  let index;
  if (group.length === 1) { index = 0; source = source || 'assigned'; }
  else if (last) { index = (ids.indexOf(last.id) + 1) % group.length; source = source || 'sequence'; }
  else if (assigned) { index = Math.max(0, ids.indexOf(idOf(assigned))); source = source || 'first'; }
  else { index = 0; source = source || 'first'; }

  // Sem ficha atribuída: prefere uma que nunca foi feita e evita repetir a última, quando há outras.
  if (source === 'fallback' && group.length > 1) {
    const never = group.findIndex((t) => !done.some((h) => h.id === idOf(t)));
    if (never !== -1) index = never;
    else {
      // Todas já feitas: a vez é da que está há mais tempo sem ser feita (rodízio de verdade, sem depender da ordem alfabética).
      const lastDate = (id) => done.find((h) => h.id === id)?.date || new Date(0);
      index = ids.reduce((best, id, i) => (lastDate(id) < lastDate(ids[best]) ? i : best), 0);
    }
  }

  const training = group[index];
  const position = { index: index + 1, total: group.length };
  const reason = (() => {
    if (source === 'sequence') return `Você concluiu ${last.name} ${whenLabel(last.daysAgo)}. A próxima da sequência (${position.index} de ${position.total}) é ${training.name}.`;
    if (source === 'first') return `Você ainda não concluiu nenhuma ficha deste programa. Comece por ${training.name}.`;
    if (source === 'fallback') return last ? `Seu último treino foi ${last.name} ${whenLabel(last.daysAgo)}. Agora é a vez deste, o que você fez há mais tempo.` : '';
    return last ? `Sua ficha atual é ${training.name} (última vez ${whenLabel(last.daysAgo)}).` : `Sua ficha atual é ${training.name}.`;
  })();
  return { ...base, training, source, last, position, reason, isAssigned: !!assigned && group.some((t) => idOf(t) === idOf(assigned)) };
}

/** Frase sobre a meta da semana, só com números reais. */
export const goalSentence = ({ weeklyGoal, weekCount, remaining, met }, trainedToday = false) => {
  if (!weeklyGoal) return '';
  if (met) return `Meta da semana cumprida (${weekCount} de ${weeklyGoal}): um treino a mais é bônus.`;
  return `${trainedToday ? 'Hoje já treinou. ' : ''}${remaining === 1 ? 'Falta 1 treino' : `Faltam ${remaining} treinos`} para a meta (${weekCount} de ${weeklyGoal}).`;
};
