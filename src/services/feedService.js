import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
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
  const posts = mergePosts(lists);
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
