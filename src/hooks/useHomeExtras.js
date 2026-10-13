import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getSocialProfile, listFriendships, loadRanking } from '../services/socialService';

// Dados extras do painel do aluno, carregados depois do conteúdo principal e sem derrubar a tela se falharem.

const whenIdle = (fn, ms = 900) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); };

/** Posição na semana entre amigos que participam do ranking. status: loading | noProfile | notSharing | noFriends | ready | error */
export function useFriendsPreview(uid) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    if (!uid) return undefined;
    let off = false;
    const cancel = whenIdle(async () => {
      try {
        const profile = await getSocialProfile(uid);
        if (off) return;
        if (!profile) { setState({ status: 'noProfile' }); return; }
        if (!profile.shareRanking) { setState({ status: 'notSharing' }); return; }
        const friendships = await listFriendships(uid);
        if (off) return;
        if (!friendships.some((f) => f.status === 'active')) { setState({ status: 'noFriends' }); return; }
        const ranking = await loadRanking(uid, profile, friendships);
        if (off) return;
        const me = ranking.rows.find((r) => r.me);
        setState({ status: ranking.rows.length > 1 ? 'ready' : 'noFriends', rows: ranking.rows, position: me?.position || null, total: ranking.rows.length });
      } catch (e) {
        if (!off) setState({ status: 'error' });
      }
    });
    return () => { off = true; cancel(); };
  }, [uid]);
  return state;
}

// ---- Mensagem do treinador ainda não lida ----
export const chatSeenKey = (uid) => `bt_chat_seen_${uid}`;
export const markChatSeen = (uid, at = Date.now()) => { try { if (uid) localStorage.setItem(chatSeenKey(uid), String(at)); } catch (e) { /* sem storage */ } };
const seenAt = (uid) => { try { return Number(localStorage.getItem(chatSeenKey(uid))) || 0; } catch (e) { return 0; } };

export const chatIdOf = (a, b) => [a, b].sort().join('_');

/** Última mensagem da conversa com o treinador e se é do treinador e ainda não vista. */
export function useCoachMessage(uid, coachId) {
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => {
    if (!uid || !coachId) { setMsg(null); return; }
    try {
      const snap = await getDocs(query(collection(db, 'chats', chatIdOf(uid, coachId), 'messages'), orderBy('createdAt', 'desc'), limit(1)));
      if (snap.empty) { setMsg(null); return; }
      const m = snap.docs[0].data();
      const at = m.createdAt?.toMillis ? m.createdAt.toMillis() : Date.now();
      setMsg({ text: String(m.text || ''), fromCoach: m.senderId === coachId, at, unread: m.senderId === coachId && at > seenAt(uid) });
    } catch (e) {
      setMsg(null); // conversa ainda não existe ou sem acesso: nada a mostrar
    }
  }, [uid, coachId]);
  useEffect(() => whenIdle(load, 600), [load]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);
  return msg;
}
