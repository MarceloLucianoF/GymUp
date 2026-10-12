import { useState, useEffect, useCallback, useRef } from 'react';
import { setDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase/config';
import { activeWorkoutService } from '../services/activeWorkoutService';
import { invalidateCheckIns } from '../services/checkInsCache';
import { saveCheckIn } from '../services/checkInService';
import { useOnlineStatus } from './useOnlineStatus';

const RETRY_MS = 60_000;

/**
 * Fila de check-ins feitos sem rede: envia ao abrir o app, ao voltar a rede, ao voltar para a aba e a cada minuto
 * enquanto houver pendência. Monte uma vez (PwaLayer). O envio é idempotente: o ID do check-in é fixo.
 * Estado: { online, total, failed, syncing, retry }.
 */
export function useOfflineSync(user) {
  const uid = user?.uid;
  const online = useOnlineStatus();
  const [queue, setQueue] = useState({ total: 0, failed: 0 });
  const [syncing, setSyncing] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(() => {
    if (!uid) { setQueue({ total: 0, failed: 0 }); return; }
    const status = activeWorkoutService.queueStatus(uid);
    setQueue((old) => (old.total === status.total && old.failed === status.failed ? old : status));
  }, [uid]);

  const sync = useCallback(async ({ force = false, announce = false } = {}) => {
    if (!uid || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;
    if (activeWorkoutService.getOfflineCheckIns(uid).length === 0) return 0;
    setSyncing(true);
    try {
      const synced = await activeWorkoutService.syncPendingCheckIns(uid, db, setDoc, doc, (id, data) => saveCheckIn(db, uid, id, data), { force });
      if (synced > 0) {
        invalidateCheckIns(uid);
        try { window.dispatchEvent(new CustomEvent('offline-queue-synced', { detail: { userId: uid, count: synced } })); } catch (e) { /* sem window */ }
        toast.success(synced === 1 ? 'Treino sincronizado!' : `${synced} treinos sincronizados!`, { id: 'offline-synced' });
      } else if (announce) {
        const left = activeWorkoutService.queueStatus(uid);
        if (left.total > 0) toast.error('Não foi possível sincronizar agora. Vamos tentar de novo.', { id: 'offline-sync-failed' });
      }
      return synced;
    } catch (err) {
      console.error('Erro ao sincronizar treinos offline:', err);
      return 0;
    } finally {
      if (mounted.current) setSyncing(false);
      refresh();
    }
  }, [uid, refresh]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Ao abrir (ou trocar de usuário): mostra o que está pendente e já tenta enviar.
  useEffect(() => { refresh(); sync(); }, [refresh, sync]);

  useEffect(() => {
    const onQueue = () => refresh();
    const onStorage = (e) => { if (!e.key || e.key.startsWith('academyup_pending_checkins_')) refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    window.addEventListener('offline-queue-updated', onQueue);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('offline-queue-updated', onQueue);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, sync]);

  // Voltou a rede: envia na hora.
  useEffect(() => { if (online) sync(); }, [online, sync]);

  // Com pendência (que a rede resolve), tenta de novo a cada minuto.
  const retryable = queue.total - queue.failed > 0;
  useEffect(() => {
    if (!retryable || !online) return undefined;
    const timer = setInterval(() => sync(), RETRY_MS);
    return () => clearInterval(timer);
  }, [retryable, online, sync]);

  const retry = useCallback(() => sync({ force: true, announce: true }), [sync]);
  return { online, total: queue.total, failed: queue.failed, syncing, retry };
}

export default useOfflineSync;
