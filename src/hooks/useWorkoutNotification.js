// Notificação fixa "Treino em andamento" (Notification API + service worker). Diferente do controle de mídia, não usa áudio:
// não pausa a música de outro app. Mostra o exercício, a série atual, a carga sugerida e o fim do descanso, com dois botões
// que mudam conforme o momento (o Android mostra no máximo dois): descansando = Pular descanso e +30 s; treinando = Concluir série e Desfazer.
// Quando o descanso acaba, a notificação toca e vibra uma vez. Só existe com a tela do treino aberta ou em segundo plano recente:
// sem servidor de push não há como atualizar com o app fechado.
import { useEffect, useRef } from 'react';

export const WORKOUT_NOTIF_TAG = 'bt-workout';
export const WORKOUT_ACTIONS = ['done', 'undo', 'rest', 'add30'];

export const workoutNotifSupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

const hhmm = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Monta título, corpo e botões da notificação a partir do estado atual do treino. */
export function workoutNotificationOptions({ title, setLabel, progress, resting, restEndsAt, image, alert }) {
  const head = resting ? `Descansando${restEndsAt ? ` até ${hhmm(restEndsAt)}` : ''}` : (alert ? 'Descanso acabou: bora!' : '');
  const lines = [head, setLabel, progress].filter(Boolean);
  return {
    title: String(title || 'Treino em andamento').slice(0, 80),
    options: {
      body: lines.join('\n').slice(0, 220),
      tag: WORKOUT_NOTIF_TAG,
      renotify: !!alert,
      silent: !alert,
      ...(alert ? { vibrate: [250, 120, 250] } : {}),
      requireInteraction: true,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...(image ? { image } : {}),
      actions: resting
        ? [{ action: 'rest', title: 'Pular descanso' }, { action: 'add30', title: '+30 s' }]
        : [{ action: 'done', title: 'Concluir série' }, { action: 'undo', title: 'Desfazer série' }],
      data: { kind: 'workout', url: '/' }
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
 * @param meta        { title, setLabel, progress, resting, restEndsAt, image } da tela atual
 * @param handlersRef ref com { done, undo, rest, add30 } (sempre a versão mais nova)
 * @returns { alertRestOver } chama quando o descanso termina sozinho (toca e vibra uma vez)
 */
export function useWorkoutNotification({ enabled, meta, handlersRef }) {
  const active = enabled && workoutNotifSupported() && Notification.permission === 'granted';
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const show = (extra = {}) => {
    if (!metaRef.current) return;
    const { title, options } = workoutNotificationOptions({ ...metaRef.current, ...extra });
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, options)).catch(() => { /* permissão revogada ou navegador sem suporte */ });
  };

  useEffect(() => {
    if (!active) return undefined;
    const onMessage = (event) => {
      if (!event.data || event.data.type !== 'WORKOUT_ACTION') return;
      handlersRef.current?.[event.data.action]?.();
      setTimeout(() => show(), 500);   // tocar num botão fecha a notificação no Android: mostra de novo com o estado novo
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => { navigator.serviceWorker.removeEventListener('message', onMessage); closeWorkoutNotification(); };
  }, [active, handlersRef]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (active) show();
  }, [active, meta?.title, meta?.setLabel, meta?.progress, meta?.resting, meta?.restEndsAt, meta?.image]);   // eslint-disable-line react-hooks/exhaustive-deps

  return { alertRestOver: () => { if (active) setTimeout(() => show({ alert: true }), 300); } };
}
