// Notificação fixa "Treino em andamento" (Notification API + service worker). Diferente do controle de mídia, não usa áudio:
// não pausa a música de outro app. Mostra o exercício e a série atual, com botões para concluir a série e pular o descanso.
// Só existe enquanto a tela do treino está aberta (ou em segundo plano recente): sem servidor de push não há como atualizar com o app fechado.
import { useEffect, useRef } from 'react';

export const WORKOUT_NOTIF_TAG = 'bt-workout';

export const workoutNotifSupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

/** Monta título, corpo e botões da notificação a partir do estado atual do treino. */
export function workoutNotificationOptions({ title, setLabel, progress, resting }) {
  const lines = [setLabel, progress].filter(Boolean);
  return {
    title: String(title || 'Treino em andamento').slice(0, 80),
    options: {
      body: `${resting ? 'Descansando · ' : ''}${lines.join('\n')}`.slice(0, 200),
      tag: WORKOUT_NOTIF_TAG,
      renotify: false,
      silent: true,
      requireInteraction: true,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      actions: [{ action: 'done', title: 'Concluir série' }, { action: 'rest', title: 'Pular descanso' }],
      data: { kind: 'workout' }
    }
  };
}

const closeWorkoutNotification = async () => {
  try {
    const reg = await navigator.serviceWorker.ready;
    (await reg.getNotifications({ tag: WORKOUT_NOTIF_TAG })).forEach((n) => n.close());
  } catch (e) { /* sem service worker */ }
};

/**
 * @param enabled     liga e desliga
 * @param meta        { title, setLabel, progress, resting } da tela atual
 * @param handlersRef ref com { done, rest } (sempre a versão mais nova)
 */
export function useWorkoutNotification({ enabled, meta, handlersRef }) {
  const active = enabled && workoutNotifSupported() && Notification.permission === 'granted';
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const show = () => {
    if (!metaRef.current) return;
    const { title, options } = workoutNotificationOptions(metaRef.current);
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, options)).catch(() => { /* permissão revogada ou navegador sem suporte */ });
  };

  useEffect(() => {
    if (!active) return undefined;
    const onMessage = (event) => {
      if (!event.data || event.data.type !== 'WORKOUT_ACTION') return;
      handlersRef.current?.[event.data.action]?.();
      setTimeout(show, 500);   // tocar num botão fecha a notificação no Android: mostra de novo com o estado novo
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => { navigator.serviceWorker.removeEventListener('message', onMessage); closeWorkoutNotification(); };
  }, [active, handlersRef]);

  useEffect(() => {
    if (active) show();
  }, [active, meta?.title, meta?.setLabel, meta?.progress, meta?.resting]);   // eslint-disable-line react-hooks/exhaustive-deps
}
