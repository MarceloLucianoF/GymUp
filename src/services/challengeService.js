import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, updateDoc, where, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { dayKey } from '../utils/consistency';
import {
  CHALLENGE_CODE_RE, activeDaysIn, endDayOf, nextScore, normalizeChallengeCode, rankMembers, validateChallengeInput
} from '../utils/challenges';

// Desafios em grupo (MVP). Contrato e limites das regras em firestore.rules ("Desafios em grupo") e docs/PLANO_SOCIAL.md.
// Só membros leem o desafio e a lista de membros; cada um publica o próprio placar de dias ativos.

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 para não confundir ao ditar
const realDeps = { db, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, updateDoc, where, writeBatch };

export function newChallengeCode(randomInt) {
  const pick = randomInt || ((n) => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] % n;
    return Math.floor(Math.random() * n);
  });
  return Array.from({ length: 8 }, () => CODE_ALPHABET[pick(CODE_ALPHABET.length)]).join('');
}

export const inviteLink = (code, origin = typeof window !== 'undefined' ? window.location.origin : '') => `${origin}/amigos?desafio=${code}`;

const memberDoc = (uid, profile, code, deps) => ({
  uid,
  displayName: profile.displayName,
  handle: profile.handle,
  code,
  joinedAt: deps.serverTimestamp(),
  activeDays: 0,
  lastDay: '',
  updatedAt: deps.serverTimestamp()
});

const needProfile = (profile) => {
  if (!profile?.handle || !profile?.displayName) throw new Error('Crie seu perfil social (nome e @usuário) para usar desafios.');
};

/** Cria o desafio com o dono como primeiro membro e reserva o código, tudo no mesmo lote. */
export async function createChallenge(uid, profile, input, { now = new Date(), deps = realDeps, randomInt } = {}) {
  needProfile(profile);
  const problem = validateChallengeInput(input);
  if (problem) throw new Error(problem);
  const durationDays = Number(input.durationDays);
  const startDay = dayKey(now);
  let code = '';
  for (let i = 0; i < 5 && !code; i += 1) {
    const candidate = newChallengeCode(randomInt);
    const taken = await deps.getDoc(deps.doc(deps.db, 'challengeCodes', candidate));
    if (!taken.exists()) code = candidate;
  }
  if (!code) throw new Error('Não foi possível gerar um código agora. Tente de novo.');
  const ref = deps.doc(deps.collection(deps.db, 'challenges'));
  const batch = deps.writeBatch(deps.db);
  batch.set(ref, {
    name: String(input.name).trim(), durationDays, startDay, endDay: endDayOf(startDay, durationDays),
    ownerId: uid, code, memberCount: 1, status: 'active', createdAt: deps.serverTimestamp()
  });
  batch.set(deps.doc(deps.db, 'challengeCodes', code), { challengeId: ref.id });
  batch.set(deps.doc(deps.db, 'challenges', ref.id, 'members', uid), memberDoc(uid, profile, code, deps));
  await batch.commit();
  return { id: ref.id, code };
}

/** Entra pelo código (o código é o convite). Retorna { id, already }. */
export async function joinChallenge(uid, profile, rawCode, { deps = realDeps } = {}) {
  needProfile(profile);
  const code = normalizeChallengeCode(rawCode);
  if (!CHALLENGE_CODE_RE.test(code)) throw new Error('O código do desafio tem 8 letras ou números.');
  const index = await deps.getDoc(deps.doc(deps.db, 'challengeCodes', code));
  if (!index.exists()) throw new Error('Código não encontrado. Confira com quem convidou você.');
  const id = index.data().challengeId;
  const mine = await deps.getDoc(deps.doc(deps.db, 'challenges', id, 'members', uid));
  if (mine.exists()) return { id, already: true };
  const batch = deps.writeBatch(deps.db);
  batch.set(deps.doc(deps.db, 'challenges', id, 'members', uid), memberDoc(uid, profile, code, deps));
  batch.update(deps.doc(deps.db, 'challenges', id), { memberCount: deps.increment(1) });
  try {
    await batch.commit();
  } catch (error) {
    if (error?.code === 'permission-denied') throw new Error('Não foi possível entrar: o desafio pode estar cheio (50 pessoas), encerrado ou já ter terminado.');
    throw error;
  }
  return { id, already: false };
}

/** Sai do desafio (o contador desce no mesmo lote). O dono não sai: encerra ou apaga. */
export async function leaveChallenge(uid, challengeId, { deps = realDeps } = {}) {
  const batch = deps.writeBatch(deps.db);
  batch.delete(deps.doc(deps.db, 'challenges', challengeId, 'members', uid));
  batch.update(deps.doc(deps.db, 'challenges', challengeId), { memberCount: deps.increment(-1) });
  await batch.commit();
}

export const endChallenge = (challengeId, { deps = realDeps } = {}) =>
  deps.updateDoc(deps.doc(deps.db, 'challenges', challengeId), { status: 'ended' });

/** Apaga o desafio inteiro (só o dono): membros, código e o desafio no mesmo lote (até 50 membros + 2). */
export async function deleteChallenge(challengeId, code, { deps = realDeps } = {}) {
  const members = await deps.getDocs(deps.collection(deps.db, 'challenges', challengeId, 'members'));
  const batch = deps.writeBatch(deps.db);
  members.docs.forEach((m) => batch.delete(m.ref));
  if (code) batch.delete(deps.doc(deps.db, 'challengeCodes', code));
  batch.delete(deps.doc(deps.db, 'challenges', challengeId));
  await batch.commit();
  return members.docs.length + (code ? 2 : 1);
}

// Só documentos de membro de desafios (challenges/{id}/members/{uid}); outras subcoleções "members" ficam de fora.
const challengeIdOf = (ref) => (ref?.parent?.parent?.parent?.id === 'challenges' ? ref.parent.parent.id : null);

async function myMemberships(uid, deps) {
  const snap = await deps.getDocs(deps.query(deps.collectionGroup(deps.db, 'members'), deps.where('uid', '==', uid)));
  return snap.docs.map((d) => ({ id: challengeIdOf(d.ref), ref: d.ref, data: d.data() })).filter((m) => m.id);
}

/** Meus desafios com o placar. Sobras de desafios apagados são limpas em silêncio. */
export async function listMyChallenges(uid, { deps = realDeps } = {}) {
  const out = [];
  for (const m of await myMemberships(uid, deps)) {
    const ch = await deps.getDoc(deps.doc(deps.db, 'challenges', m.id));
    if (!ch.exists()) { await deps.deleteDoc(m.ref).catch(() => {}); continue; }
    const members = await deps.getDocs(deps.collection(deps.db, 'challenges', m.id, 'members'));
    out.push({ id: m.id, ...ch.data(), me: m.data, members: members.docs.map((d) => d.data()) });
  }
  return out.sort((a, b) => String(b.startDay).localeCompare(String(a.startDay)));
}

/**
 * Publica o próprio placar (dias ativos) em cada desafio a partir dos check-ins do aparelho, e acompanha nome/@ do perfil.
 * Leve: só grava quando algo mudou. Retorna a lista com os valores novos.
 */
export async function syncMyScores(uid, challenges, checkIns, profile, { today = dayKey(new Date()), deps = realDeps } = {}) {
  const out = [];
  for (const ch of challenges || []) {
    const next = nextScore(ch.me, ch, activeDaysIn(checkIns, ch, today), today);
    const rename = profile?.handle && (profile.displayName !== ch.me?.displayName || profile.handle !== ch.me?.handle);
    if (!next && !rename) { out.push(ch); continue; }
    const patch = { ...(next || {}), ...(rename ? { displayName: profile.displayName, handle: profile.handle } : {}) };
    try {
      await deps.updateDoc(deps.doc(deps.db, 'challenges', ch.id, 'members', uid), { ...patch, updatedAt: deps.serverTimestamp() });
      const me = { ...ch.me, ...patch };
      out.push({ ...ch, me, members: (ch.members || []).map((m) => (m.uid === uid ? me : m)) });
    } catch (error) {
      console.warn('Placar do desafio não atualizado:', error?.code || error);
      out.push(ch);
    }
  }
  return out;
}

/**
 * Depois de concluir um treino: atualiza o placar dos desafios em andamento sem precisar abrir a aba Desafios.
 * Sem perfil, só o placar muda (nome e @ continuam sendo acompanhados quando a aba abre). Devolve quantos desafios foram vistos.
 */
export async function syncScoresAfterWorkout(uid, fetchCheckIns, { today = dayKey(new Date()), deps = realDeps } = {}) {
  const active = (await listMyChallenges(uid, { deps })).filter((c) => c.status === 'active');
  if (!active.length) return 0;
  await syncMyScores(uid, active, await fetchCheckIns(uid), null, { today, deps });
  return active.length;
}

export const scoreboard = (ch, uid) => rankMembers(ch?.members, uid);

/** Exclusão de conta: sai de todos os desafios e apaga os que a pessoa criou. Retorna quantos documentos saíram. */
export async function leaveAllChallenges(uid, { deps = realDeps } = {}) {
  let removed = 0;
  for (const m of await myMemberships(uid, deps)) {
    const ch = await deps.getDoc(deps.doc(deps.db, 'challenges', m.id));
    if (!ch.exists()) { await deps.deleteDoc(m.ref); removed += 1; continue; }
    const data = ch.data() || {};
    if (data.ownerId === uid) {
      removed += await deleteChallenge(m.id, data.code, { deps });
    } else {
      await leaveChallenge(uid, m.id, { deps });
      removed += 1;
    }
  }
  return removed;
}
