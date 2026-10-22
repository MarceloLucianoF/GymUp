import { weekStart } from './analytics';

// Atividade entre amigos: o que vai para o post é só o resumo do treino (sem carga, volume ou dado de saúde).
const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));

/** Título seguro para exibir: sem links nem e-mails, no máximo 60 caracteres. */
export function cleanTitle(raw) {
  const text = String(raw || '')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
  return text || 'Treino';
}

/** Monta o post dentro dos limites das regras do Firestore. */
export function buildPostPayload(uid, { trainingName, durationSeconds, setsCompleted, exercisesCount, newRecords, weekCount }, nowIso = new Date().toISOString()) {
  return {
    authorId: uid,
    kind: 'workout',
    title: cleanTitle(trainingName),
    minutes: clamp((Number(durationSeconds) || 0) / 60, 1, 600),
    workSets: clamp(setsCompleted, 0, 300),
    exercises: clamp(exercisesCount, 1, 40),
    records: clamp(newRecords, 0, 40),
    weekCount: clamp(weekCount, 0, 14),
    createdAt: nowIso
  };
}

/** Frase curta do post para a lista de atividade. */
export function postLine(post) {
  const parts = [`${post.minutes} min`, `${post.workSets} séries`];
  if (post.weekCount > 0) parts.push(`${post.weekCount}º treino da semana`);
  if (post.records > 0) parts.push(`${post.records} ${post.records === 1 ? 'recorde' : 'recordes'}`);
  return parts.join(' · ');
}

/** Junta posts de vários amigos, do mais novo ao mais antigo, e limita o total. */
export function mergePosts(lists, limit = 30) {
  return lists.flat().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
}

export const timeAgo = (iso, now = Date.now()) => {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
};

/** Curtidas mais novas que `since` (ISO). Sem `since`, só as das últimas 24 h, para não avisar o histórico todo. */
export function newLikes(items, since, now = Date.now()) {
  const floor = since || new Date(now - 24 * 3600 * 1000).toISOString();
  return (items || []).filter((l) => l.at && String(l.at) > floor);
}

/** Texto do aviso: um nome quando é uma pessoa, contagem quando são várias. */
export function likeAlertText(items, names = {}) {
  if (!items.length) return '';
  const people = [...new Set(items.map((l) => l.likerId))];
  if (items.length === 1) return `${names[items[0].likerId] || 'Um amigo'} curtiu seu treino "${items[0].title}".`;
  if (people.length === 1) return `${names[people[0]] || 'Um amigo'} curtiu ${items.length} treinos seus.`;
  return `${items.length} curtidas novas nos seus treinos.`;
}

/** Quantos treinos o aluno registrou nesta semana (segunda a domingo), contando o que acabou de salvar. */
export function weekCountOf(checkIns, now = new Date()) {
  const from = weekStart(now).getTime();
  return (checkIns || []).filter((c) => { const t = new Date(c.date || c.createdAt).getTime(); return Number.isFinite(t) && t >= from; }).length;
}
