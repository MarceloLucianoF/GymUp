import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuthContext } from '../../hooks/AuthContext';
import { likesOnMyPosts, likesSeenAt } from '../../services/feedService';
import { getSocialProfile } from '../../services/socialService';
import { likeAlertText, newLikes } from '../../utils/feed';

const EVERY_MS = 15 * 60 * 1000;   // cada conferência lê os 5 posts mais novos e as curtidas deles
const notifiedKey = (uid) => `bt_likes_notified:${uid}`;
const read = (key) => { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch (_) { /* sem storage */ } };

// Aviso de curtidas novas nos treinos publicados. Sem servidor de push: confere ao abrir o app e a cada 15 min com ele aberto.
// Com o app em segundo plano e a permissão de notificação concedida, vira notificação do sistema; senão, um aviso na tela.
export default function LikeAlerts() {
  const { user, userProfile } = useAuthContext();
  const uid = user?.uid;
  const enabled = !!uid && userProfile?.role === 'user';

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const check = async () => {
      try {
        const since = [likesSeenAt(uid), read(notifiedKey(uid))].sort().pop();
        const fresh = newLikes(await likesOnMyPosts(uid), since);
        if (!alive || !fresh.length) return;
        write(notifiedKey(uid), fresh[0].at);
        const names = {};
        await Promise.all([...new Set(fresh.map((l) => l.likerId))].slice(0, 3).map(async (id) => {
          try { const p = await getSocialProfile(id); if (p?.displayName) names[id] = p.displayName; } catch (_) { /* sem permissão: "Um amigo" */ }
        }));
        const text = likeAlertText(fresh, names);
        const canNotify = typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator;
        if (document.hidden && canNotify) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification('Curtidas no BohTreinar', { body: text, tag: 'bt-likes', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/amigos?aba=atividade' } });
        } else {
          toast(text, { icon: '❤️', duration: 6000, id: 'bt-likes' });
        }
      } catch (_) { /* sem posts, sem rede ou sem índice: tenta na próxima */ }
    };
    check();
    const timer = setInterval(check, EVERY_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [enabled, uid]);

  return null;
}
