import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { mergePosts } from '../utils/feed';
import { otherOf } from './socialService';

const PER_FRIEND = 3;
const MAX_FRIENDS = 30;

/** Publica um post de treino (as regras exigem que o perfil público tenha shareWorkouts ligado). */
export async function publishPost(postId, payload) {
  await setDoc(doc(db, 'socialPosts', postId), payload); // id = id do check-in: reenvio vira "update", que as regras negam (sem post duplicado)
  return postId;
}

/** Apaga o post e as curtidas dele (as curtidas ficam numa subcoleção). */
export async function deletePost(postId) {
  const likes = await getDocs(collection(db, 'socialPosts', postId, 'likes'));
  for (const d of likes.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, 'socialPosts', postId));
}

/** Apaga todos os meus posts (e as curtidas deles): usado ao parar de compartilhar treinos. */
export async function deleteMyPosts(uid) {
  const snap = await getDocs(query(collection(db, 'socialPosts'), where('authorId', '==', uid)));
  for (const d of snap.docs) await deletePost(d.id);
  return snap.size;
}

/** Atividade dos amigos ativos e a minha. Uma consulta por autor: as regras não filtram listas com `in`. */
export async function listFeed(uid, friendships) {
  const friends = (friendships || []).filter((f) => f.status === 'active').map((f) => otherOf(f, uid)).slice(0, MAX_FRIENDS);
  const authors = [uid, ...friends];
  const lists = await Promise.all(authors.map(async (authorId) => {
    try {
      const snap = await getDocs(query(collection(db, 'socialPosts'), where('authorId', '==', authorId), orderBy('createdAt', 'desc'), limit(PER_FRIEND)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      if (error?.code === 'permission-denied') return []; // amigo parou de compartilhar
      throw error;
    }
  }));
  const hidden = hiddenPostIds(uid);
  const posts = mergePosts(lists).filter((p) => !hidden.has(p.id));
  return Promise.all(posts.map(async (post) => {
    try {
      const likes = await getDocs(collection(db, 'socialPosts', post.id, 'likes'));
      return { ...post, likeCount: likes.size, liked: likes.docs.some((d) => d.id === uid) };
    } catch (_) { return { ...post, likeCount: 0, liked: false }; }
  }));
}

export async function setLike(postId, uid, on) {
  const ref = doc(db, 'socialPosts', postId, 'likes', uid);
  if (on) await setDoc(ref, { at: new Date().toISOString(), likerId: uid }); else await deleteDoc(ref);
}

// ---- denúncia ----
export const REPORT_REASONS = [['spam', 'Spam'], ['ofensivo', 'Ofensivo'], ['improprio', 'Impróprio'], ['outro', 'Outro motivo']];
const hiddenKey = (uid) => `bt_feed_hidden:${uid}`;

/** Posts que eu denunciei somem do meu feed na hora (o admin decide se o post sai para todos). */
export function hiddenPostIds(uid, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { return new Set(JSON.parse(storage?.getItem(hiddenKey(uid)) || '[]')); } catch (_) { return new Set(); }
}

export async function reportPost(uid, post, reason) {
  await setDoc(doc(db, 'socialReports', `${uid}_${post.id}`), { reporterId: uid, postId: post.id, authorId: post.authorId, reason, createdAt: new Date().toISOString() });
  try {
    const ids = hiddenPostIds(uid);
    ids.add(post.id);
    localStorage.setItem(hiddenKey(uid), JSON.stringify([...ids].slice(-200)));
  } catch (_) { /* sem storage: o post só some quando o admin remover */ }
}

/** Painel do admin: denúncias agrupadas por post, com o post (se ainda existe). */
export async function listReports() {
  const snap = await getDocs(query(collection(db, 'socialReports'), orderBy('createdAt', 'desc'), limit(200)));
  const groups = new Map();
  snap.docs.forEach((d) => {
    const r = { id: d.id, ...d.data() };
    if (r.status === 'dismissed') return;
    if (!groups.has(r.postId)) groups.set(r.postId, { postId: r.postId, authorId: r.authorId, reports: [] });
    groups.get(r.postId).reports.push(r);
  });
  return Promise.all([...groups.values()].map(async (g) => {
    try { const p = await getDoc(doc(db, 'socialPosts', g.postId)); return { ...g, post: p.exists() ? { id: p.id, ...p.data() } : null }; }
    catch (_) { return { ...g, post: null }; }
  }));
}

/** Admin: remover apaga o post (com curtidas) e as denúncias; dispensar só marca as denúncias (não voltam à fila).
 *  Denúncia de post que já não existe é apagada. */
export async function resolveReports(group, { removePost }) {
  if (removePost && group.post) await deletePost(group.postId);
  for (const r of group.reports) {
    if (removePost || !group.post) await deleteDoc(doc(db, 'socialReports', r.id));
    else await updateDoc(doc(db, 'socialReports', r.id), { status: 'dismissed' });
  }
}

// ---- curtidas recebidas ----
const seenKey = (uid) => `bt_likes_seen:${uid}`;
export const likesSeenAt = (uid) => { try { return localStorage.getItem(seenKey(uid)) || ''; } catch (_) { return ''; } };
export const markLikesSeen = (uid, at = new Date().toISOString()) => { try { localStorage.setItem(seenKey(uid), at); } catch (_) { /* sem storage */ } };

/** Curtidas dos amigos nos meus posts mais recentes (as minhas não contam), da mais nova para a mais antiga. */
export async function likesOnMyPosts(uid, max = 5) {
  const posts = await getDocs(query(collection(db, 'socialPosts'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(max)));
  const lists = await Promise.all(posts.docs.map(async (p) => {
    const likes = await getDocs(collection(db, 'socialPosts', p.id, 'likes'));
    return likes.docs.filter((l) => l.id !== uid).map((l) => ({ postId: p.id, title: p.data().title, likerId: l.id, at: l.data().at || '' }));
  }));
  return lists.flat().sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
