import { addDoc, collection, deleteField, doc, endAt, getDoc, getDocs, limit, orderBy, query, setDoc, startAt, Timestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { consistency, publicStatsOf, rankRows } from '../utils/consistency';

// Amigos e ranking de consistência. Nada aqui lê medidas, check-ins ou histórico: só o perfil público escolhido pelo
// próprio usuário e a cópia pública mínima dos contadores (publicStats). As regras do Firestore garantem isso.

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
  // Índice de busca: só nome e @, e só enquanto a pessoa quer ser encontrada (as regras conferem no mesmo lote).
  if (input.discoverable) batch.set(doc(db, 'profileSearch', user.uid), { uid: user.uid, displayName, displayNameLower: lowerName(displayName), handle });
  else if (existing?.discoverable) batch.delete(doc(db, 'profileSearch', user.uid));
  batch.set(doc(db, 'publicProfiles', user.uid), {
    uid: user.uid,
    displayName,
    displayNameLower: lowerName(displayName),
    handle,
    photoURL: '',
    friendCode,
    discoverable: !!input.discoverable,
    shareRanking: !!input.shareRanking,
    shareWorkouts: !!input.shareWorkouts,
    weeklyGoal: Math.min(7, Math.max(2, Number(input.weeklyGoal) || 4)),
    updatedAt: now()
  });
  await batch.commit();
  if (existing && existing.shareRanking !== !!input.shareRanking) log(user.uid, input.shareRanking ? 'entrar-ranking' : 'sair-ranking');
}

// ---- busca: @usuário ou código exatos, e prefixo do nome/@ entre quem escolheu ser encontrado ----
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

export const SEARCH_LIMIT = 10;   // as regras aceitam até 10 por consulta
export const SEARCH_MIN = 2;

/**
 * Busca por prefixo do nome ("marc" acha "Marcelo") e do @usuário, só entre perfis com discoverable == true (as regras
 * exigem esse filtro e limite <= 20). As regras não conseguem filtrar bloqueios numa lista: aqui some quem bloqueou o
 * usuário ou foi bloqueado por ele (pela amizade do par), e o próprio usuário.
 */
export async function searchProfiles(raw, { uid, friendships } = {}) {
  const text = String(raw || '').trim();
  const name = lowerName(text.replace(/^@/, '')).slice(0, 60);
  const handle = normalizeHandle(text);
  if (name.length < SEARCH_MIN) return [];
  const col = collection(db, 'profileSearch');   // só nome, @ e uid de quem quer ser encontrado
  const prefix = (field, value) => query(col, orderBy(field), startAt(value), endAt(`${value}\uf8ff`), limit(SEARCH_LIMIT));
  const queries = [];
  if (!text.startsWith('@')) queries.push(prefix('displayNameLower', name));
  if (/^[a-z0-9_]{2,20}$/.test(handle)) queries.push(prefix('handle', handle));
  const settled = await Promise.allSettled(queries.map((q) => getDocs(q)));
  if (settled.every((r) => r.status === 'rejected')) throw settled[0].reason;
  const byUid = new Map();
  settled.forEach((r) => { if (r.status === 'fulfilled') r.value.docs.forEach((d) => { if (!byUid.has(d.id)) byUid.set(d.id, { ...d.data(), uid: d.id }); }); });
  const pairs = friendships || (uid ? await listFriendships(uid) : []);
  const hidden = new Set(pairs.filter((f) => f.status === 'blocked').map((f) => otherOf(f, uid)));
  return [...byUid.values()].filter((p) => p.uid !== uid && !hidden.has(p.uid)).slice(0, SEARCH_LIMIT);
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

const isDenied = (error) => error?.code === 'permission-denied';
const toMillis = (value) => (typeof value?.toMillis === 'function' ? value.toMillis() : Number(value) || 0);

export async function sendRequest(uid, other) {
  if (uid === other) throw new Error('Você não pode adicionar a si mesmo.');
  const id = pairId(uid, other);
  const current = await getFriendship(uid, other);
  const rel = relationOf(current, uid);
  if (rel === 'active') throw new Error('Vocês já são amigos.');
  if (rel === 'pending-out') throw new Error('O pedido já foi enviado.');
  if (rel === 'pending-in') { await respond(uid, other, 'accept'); return 'accepted'; } // ele já tinha pedido: vira amizade
  if (rel === 'blocked' || rel === 'blocked-by-me') throw new Error('Não foi possível enviar o pedido.');
  if (current && current.requestedBy === uid) { // fui recusado antes: espera e limite de tentativas (as regras repetem esta conferência)
    if ((current.declines || 0) >= 3) throw new Error('Este pedido não foi aceito nas tentativas anteriores.');
    if (toMillis(current.retryAfter) > Date.now()) throw new Error('Aguarde um dia para pedir de novo.');
  }
  const [userA, userB] = uid < other ? [uid, other] : [other, uid];
  try {
    if (current) {
      await writeBatch(db).update(doc(db, 'friendships', id), { status: 'pending', requestedBy: uid, updatedAt: now() }).commit();
    } else {
      await writeBatch(db).set(doc(db, 'friendships', id), { userA, userB, status: 'pending', requestedBy: uid, createdAt: now(), updatedAt: now() }).commit();
    }
  } catch (error) {
    if (!isDenied(error)) throw error;
    // Pedidos cruzados ao mesmo tempo: o outro lado gravou primeiro. Relê e segue o estado que ficou, sem erro visível.
    const after = relationOf(await getFriendship(uid, other), uid);
    if (after === 'pending-in') { await respond(uid, other, 'accept'); return 'accepted'; }
    if (after === 'pending-out' || after === 'active') return after === 'active' ? 'accepted' : 'sent';
    throw error;
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
  if (action === 'decline') { // cada recusa soma 1 e fixa um dia de espera para quem pediu (as regras exigem)
    const snap = await getDoc(ref);
    const declines = (snap.exists() ? snap.data().declines || 0 : 0) + 1;
    Object.assign(patch, { declines, retryAfter: Timestamp.fromMillis(Date.now() + 24 * 3600_000 + 60_000) });
  }
  await writeBatch(db).update(ref, { ...patch, updatedAt: now() }).commit();
  log(uid, { accept: 'aceitar', decline: 'recusar', cancel: 'cancelar', remove: 'remover', block: 'bloquear', unblock: 'desbloquear' }[action], other, id);
}

// ---- ranking ----
/** Mantém o publicStats do próprio usuário igual ao userStats (cobre quem já tinha treinos antes do espelho existir). */
export async function syncPublicStats(uid, nowDate = new Date()) {
  const [mine, current] = await Promise.all([getDoc(doc(db, 'userStats', uid)), getDoc(doc(db, 'publicStats', uid))]);
  if (!mine.exists()) return false;
  const next = publicStatsOf(mine.data(), uid, nowDate.toISOString());
  const old = current.exists() ? current.data() : null;
  const same = old && ['weekKey', 'weekWorkouts', 'activeDays', 'streak', 'lastActiveDay'].every((k) => old[k] === next[k]);
  if (same) return false;
  await setDoc(doc(db, 'publicStats', uid), next);
  return true;
}

/** Linhas do ranking: eu (se participo) + amigos ativos que participam. Falha de leitura de um amigo só o tira da lista. */
export async function loadRanking(uid, myProfile, friendships, nowDate = new Date()) {
  if (!myProfile?.shareRanking) return { participating: false, rows: [] };
  const friendIds = friendships.filter((f) => f.status === 'active').map((f) => otherOf(f, uid)).slice(0, 30);
  const read = async (id, mine) => {
    try {
      const [stats, profile] = await Promise.all([getDoc(doc(db, 'publicStats', id)), mine ? Promise.resolve(null) : getDoc(doc(db, 'publicProfiles', id))]);
      const p = mine ? myProfile : (profile.exists() ? profile.data() : null);
      if (!p || (!mine && !p.shareRanking)) return null;
      const c = consistency(stats.exists() ? stats.data() : null, nowDate);
      return { uid: id, name: p.displayName, handle: p.handle, me: mine, goal: p.weeklyGoal, goalMet: c.workouts >= (p.weeklyGoal || 4), ...c };
    } catch (_) { return null; }
  };
  const rows = (await Promise.all([read(uid, true), ...friendIds.map((id) => read(id, false))])).filter(Boolean);
  return { participating: true, rows: rankRows(rows) };
}
