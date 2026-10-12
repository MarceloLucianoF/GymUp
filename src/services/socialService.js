import { addDoc, collection, deleteField, doc, getDoc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { consistency, rankRows } from '../utils/consistency';

// Amigos e ranking de consistência. Nada aqui lê medidas, check-ins ou histórico: só o perfil público escolhido pelo
// próprio usuário e os contadores de consistência (userStats). As regras do Firestore garantem isso.

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 para não confundir ao ditar
const now = () => new Date().toISOString();

export const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
export const otherOf = (friendship, uid) => (friendship.userA === uid ? friendship.userB : friendship.userA);
export const normalizeHandle = (value) => String(value || '').trim().replace(/^@/, '').toLowerCase();
export const normalizeCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
export const lowerName = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const newFriendCode = (random = Math.random) =>
  Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('');

export function validateHandle(handle) {
  if (!HANDLE_RE.test(handle)) return 'Use de 3 a 20 letras minúsculas, números ou _.';
  return '';
}

/** O que o aluno vê da sua situação com outra pessoa: none | pending-out | pending-in | active | blocked-by-me | blocked. */
export function relationOf(friendship, uid) {
  if (!friendship) return 'none';
  if (friendship.status === 'active') return 'active';
  if (friendship.status === 'pending') return friendship.requestedBy === uid ? 'pending-out' : 'pending-in';
  if (friendship.status === 'blocked') return friendship.blockedBy === uid ? 'blocked-by-me' : 'blocked';
  return 'none'; // removed
}

const log = (uid, action, other, pair) => addDoc(collection(db, 'socialLog'), { at: now(), uid, action, other: other || '', pairId: pair || '' }).catch(() => {});

// ---- perfil público ----
export async function getSocialProfile(uid) {
  const snap = await getDoc(doc(db, 'publicProfiles', uid));
  return snap.exists() ? snap.data() : null;
}

/** Cria ou atualiza o perfil. @usuário e código de amigo são reservados no mesmo lote (únicos). */
export async function saveSocialProfile(user, input, existing) {
  const handle = normalizeHandle(input.handle);
  const problem = validateHandle(handle);
  if (problem) throw new Error(problem);
  const displayName = String(input.displayName || user.displayName || 'Aluno').trim().slice(0, 60) || 'Aluno';

  const batch = writeBatch(db);
  const handleChanged = !existing || existing.handle !== handle;
  if (handleChanged) {
    const taken = await getDoc(doc(db, 'handles', handle));
    if (taken.exists() && taken.data().uid !== user.uid) throw new Error('Esse @usuário já está em uso.');
    if (!taken.exists()) batch.set(doc(db, 'handles', handle), { uid: user.uid });
    if (existing?.handle && existing.handle !== handle) batch.delete(doc(db, 'handles', existing.handle));
  }
  let friendCode = existing?.friendCode;
  if (!friendCode) {
    friendCode = newFriendCode();
    batch.set(doc(db, 'friendCodes', friendCode), { uid: user.uid });
  }
  batch.set(doc(db, 'publicProfiles', user.uid), {
    uid: user.uid,
    displayName,
    displayNameLower: lowerName(displayName),
    handle,
    photoURL: '',
    friendCode,
    discoverable: !!input.discoverable,
    shareRanking: !!input.shareRanking,
    weeklyGoal: Math.min(7, Math.max(2, Number(input.weeklyGoal) || 4)),
    updatedAt: now()
  });
  await batch.commit();
  if (existing && existing.shareRanking !== !!input.shareRanking) log(user.uid, input.shareRanking ? 'entrar-ranking' : 'sair-ranking');
}

// ---- busca ----
export async function searchByName(term, max = 12) {
  const t = lowerName(term);
  if (t.length < 2) return [];
  const snap = await getDocs(query(collection(db, 'publicProfiles'), where('discoverable', '==', true), where('displayNameLower', '>=', t), where('displayNameLower', '<=', `${t}`), limit(max)));
  return snap.docs.map((d) => d.data());
}

/** Busca por @usuário ou por código de amigo (8 caracteres). Devolve o perfil, ou só o uid se o perfil for privado. */
export async function findByHandleOrCode(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const code = normalizeCode(text);
  const handle = normalizeHandle(text);
  const tries = text.startsWith('@') ? ['handle'] : (/^[A-Z0-9]{8}$/.test(code) ? ['code', 'handle'] : ['handle']);
  let uid = null;
  let foundBy = null;
  for (const how of tries) {
    if (uid) break;
    if (how === 'code') { const c = await getDoc(doc(db, 'friendCodes', code)); uid = c.exists() ? c.data().uid : null; foundBy = 'code'; }
    else if (HANDLE_RE.test(handle)) { const h = await getDoc(doc(db, 'handles', handle)); uid = h.exists() ? h.data().uid : null; foundBy = 'handle'; }
  }
  if (!uid) return null;
  try { return (await getSocialProfile(uid)) || { uid, displayName: 'Usuário', handle: '' }; }
  catch (_) { return { uid, displayName: 'Usuário', handle: foundBy === 'handle' ? handle : '', restricted: true }; }
}

// ---- amizades ----
export async function listFriendships(uid) {
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('userA', '==', uid))),
    getDocs(query(collection(db, 'friendships'), where('userB', '==', uid)))
  ]);
  return [...a.docs, ...b.docs].map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFriendship(uid, other) {
  const snap = await getDoc(doc(db, 'friendships', pairId(uid, other)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function sendRequest(uid, other) {
  if (uid === other) throw new Error('Você não pode adicionar a si mesmo.');
  const id = pairId(uid, other);
  const current = await getFriendship(uid, other);
  const rel = relationOf(current, uid);
  if (rel === 'active') throw new Error('Vocês já são amigos.');
  if (rel === 'pending-out') throw new Error('O pedido já foi enviado.');
  if (rel === 'pending-in') { await respond(uid, other, 'accept'); return 'accepted'; } // ele já tinha pedido: vira amizade
  if (rel === 'blocked' || rel === 'blocked-by-me') throw new Error('Não foi possível enviar o pedido.');
  const [userA, userB] = uid < other ? [uid, other] : [other, uid];
  if (current) {
    await writeBatch(db).update(doc(db, 'friendships', id), { status: 'pending', requestedBy: uid, updatedAt: now() }).commit();
  } else {
    await writeBatch(db).set(doc(db, 'friendships', id), { userA, userB, status: 'pending', requestedBy: uid, createdAt: now(), updatedAt: now() }).commit();
  }
  log(uid, 'pedir', other, id);
  return 'sent';
}

/** accept | decline | cancel | remove | block | unblock */
export async function respond(uid, other, action) {
  const id = pairId(uid, other);
  const ref = doc(db, 'friendships', id);
  const patch = {
    accept: { status: 'active' },
    decline: { status: 'removed' },
    cancel: { status: 'removed' },
    remove: { status: 'removed' },
    block: { status: 'blocked', blockedBy: uid },
    unblock: { status: 'removed', blockedBy: deleteField() }
  }[action];
  if (!patch) throw new Error('Ação inválida.');
  await writeBatch(db).update(ref, { ...patch, updatedAt: now() }).commit();
  log(uid, { accept: 'aceitar', decline: 'recusar', cancel: 'cancelar', remove: 'remover', block: 'bloquear', unblock: 'desbloquear' }[action], other, id);
}

// ---- ranking ----
/** Linhas do ranking: eu (se participo) + amigos ativos que participam. Falha de leitura de um amigo só o tira da lista. */
export async function loadRanking(uid, myProfile, friendships, nowDate = new Date()) {
  if (!myProfile?.shareRanking) return { participating: false, rows: [] };
  const friendIds = friendships.filter((f) => f.status === 'active').map((f) => otherOf(f, uid)).slice(0, 30);
  const read = async (id, mine) => {
    try {
      const [stats, profile] = await Promise.all([getDoc(doc(db, 'userStats', id)), mine ? Promise.resolve(null) : getDoc(doc(db, 'publicProfiles', id))]);
      const p = mine ? myProfile : (profile.exists() ? profile.data() : null);
      if (!p || (!mine && !p.shareRanking)) return null;
      const c = consistency(stats.exists() ? stats.data() : null, nowDate);
      return { uid: id, name: p.displayName, handle: p.handle, me: mine, goal: p.weeklyGoal, goalMet: c.workouts >= (p.weeklyGoal || 4), ...c };
    } catch (_) { return null; }
  };
  const rows = (await Promise.all([read(uid, true), ...friendIds.map((id) => read(id, false))])).filter(Boolean);
  return { participating: true, rows: rankRows(rows) };
}
