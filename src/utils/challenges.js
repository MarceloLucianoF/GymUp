// Desafios em grupo (estilo GymRats, MVP): placar de dias ativos calculado no aparelho a partir dos próprios check-ins.
// Só datas (AAAA-MM-DD no fuso do aparelho): nenhum dado de saúde, carga ou medida.
import { dayKey } from './consistency';

export const CHALLENGE_DURATIONS = [7, 30];
export const CHALLENGE_NAME_MAX = 40;
export const CHALLENGE_MAX_MEMBERS = 50;
export const CHALLENGE_CODE_RE = /^[A-Z0-9]{8}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const utc = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Soma dias a uma data AAAA-MM-DD (sem depender do fuso). */
export const addDays = (key, n) => new Date(utc(key) + n * DAY_MS).toISOString().slice(0, 10);

/** Dias de calendário de `a` até `b` (b - a). */
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY_MS);

export const endDayOf = (startDay, durationDays) => addDays(startDay, durationDays - 1);

/** Dia (AAAA-MM-DD, fuso do aparelho) de um check-in: aceita texto ISO, Date ou Timestamp do Firestore. */
export const checkInDay = (checkIn) => {
  const raw = checkIn?.date ?? checkIn?.completedAt ?? checkIn?.createdAt;
  if (!raw) return '';
  const value = typeof raw?.toDate === 'function' ? raw.toDate() : raw;
  return dayKey(value);
};

/** upcoming | active | finished (passou do fim) | ended (o dono encerrou). */
export function challengeState(ch, today = dayKey(new Date())) {
  if (!ch) return 'ended';
  if (ch.status === 'ended') return 'ended';
  if (today < ch.startDay) return 'upcoming';
  if (today > ch.endDay) return 'finished';
  return 'active';
}

/** Dia do desafio (1..duração) para mostrar "dia 3 de 7". */
export function dayOfChallenge(ch, today = dayKey(new Date())) {
  if (!ch?.startDay) return 0;
  const n = daysBetween(ch.startDay, today) + 1;
  return Math.max(0, Math.min(ch.durationDays || 0, n));
}

/** Dias distintos com treino dentro do período (até hoje), em ordem. */
export function activeDaysIn(checkIns, ch, today = dayKey(new Date())) {
  if (!ch?.startDay || !ch?.endDay) return [];
  const last = today < ch.endDay ? today : ch.endDay;
  const days = new Set();
  (checkIns || []).forEach((c) => {
    const d = checkInDay(c);
    if (DAY_RE.test(d) && d >= ch.startDay && d <= last) days.add(d);
  });
  return [...days].sort();
}

/**
 * Próximo placar do próprio membro, ou null se não há o que gravar. Respeita as regras do Firestore:
 * só sobe, no máximo 1 dia ativo por dia de calendário desde o último dia contado, nunca no futuro.
 */
export function nextScore(member, ch, days, today = dayKey(new Date())) {
  if (!member || !ch || ch.status !== 'active' || !days?.length) return null;
  const lastDay = days[days.length - 1];
  if (lastDay > today || lastDay < ch.startDay || lastDay > ch.endDay) return null;
  const current = Number(member.activeDays) || 0;
  const currentLast = member.lastDay || '';
  if (days.length <= current || lastDay <= currentLast) return null;
  const gap = daysBetween(currentLast || addDays(ch.startDay, -1), lastDay);
  const activeDays = Math.min(days.length, current + gap, ch.durationDays || 30, 30);
  return activeDays > current ? { activeDays, lastDay } : null;
}

/** Placar: mais dias ativos primeiro; empate fica na mesma posição; depois quem chegou antes e o nome. */
export function rankMembers(members, uid) {
  const sorted = [...(members || [])].sort((a, b) => (Number(b.activeDays) || 0) - (Number(a.activeDays) || 0)
    || String(a.lastDay || '9999').localeCompare(String(b.lastDay || '9999'))
    || String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR'));
  const out = [];
  sorted.forEach((m, i) => {
    const days = Number(m.activeDays) || 0;
    const tied = i > 0 && (Number(sorted[i - 1].activeDays) || 0) === days;
    out.push({ ...m, activeDays: days, me: m.uid === uid, position: tied ? out[i - 1].position : i + 1 });
  });
  return out;
}

export function validateChallengeInput({ name, durationDays } = {}) {
  const clean = String(name || '').trim();
  if (!clean) return 'Dê um nome ao desafio.';
  if (clean.length > CHALLENGE_NAME_MAX) return `Use até ${CHALLENGE_NAME_MAX} caracteres no nome.`;
  if (/(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}([/:?#]|\b))/i.test(clean)) return 'O nome não pode ter links.';
  if (!CHALLENGE_DURATIONS.includes(Number(durationDays))) return 'Escolha 7 ou 30 dias.';
  return '';
}

export const normalizeChallengeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
