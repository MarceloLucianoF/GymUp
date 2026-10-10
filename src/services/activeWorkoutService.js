/**
 * Service de Persistência de Treino Ativo e Fila Offline para o BohTreinar
 */

const ACTIVE_WORKOUT_PREFIX = 'academyup_active_workout_';
const OFFLINE_CHECKINS_PREFIX = 'academyup_pending_checkins_';

export const activeWorkoutService = {
  /**
   * Salva o estado atual do treino em andamento no localStorage.
   */
  saveActiveSession(userId, sessionData) {
    if (!userId || !sessionData) return;
    try {
      const key = `${ACTIVE_WORKOUT_PREFIX}${userId}`;
      const payload = {
        ...sessionData,
        lastUpdated: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(payload));
      try {
        window.dispatchEvent(new CustomEvent('active-workout-updated', { detail: { userId } }));
      } catch (e) {}
    } catch (err) {
      console.error('Erro ao salvar sessão local de treino:', err);
    }
  },

  /**
   * Recupera o treino em andamento do usuário.
   */
  getActiveSession(userId) {
    if (!userId) return null;
    try {
      const key = `${ACTIVE_WORKOUT_PREFIX}${userId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      
      // Validação: expirar sessões com mais de 24 horas sem atualização
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      if (Date.now() - (parsed.lastUpdated || 0) > TWENTY_FOUR_HOURS) {
        this.clearActiveSession(userId);
        return null;
      }
      return parsed;
    } catch (err) {
      console.error('Erro ao recuperar sessão local de treino:', err);
      return null;
    }
  },

  /**
   * Remove o rascunho do treino em andamento.
   */
  clearActiveSession(userId) {
    if (!userId) return;
    try {
      const key = `${ACTIVE_WORKOUT_PREFIX}${userId}`;
      localStorage.removeItem(key);
      try {
        window.dispatchEvent(new CustomEvent('active-workout-updated', { detail: { userId } }));
      } catch (e) {}
    } catch (err) {
      console.error('Erro ao limpar sessão local de treino:', err);
    }
  },

  /**
   * Fila Offline: Salva check-in pendente caso ocorra falha de rede ao finalizar.
   */
  // ID estável do check-in, gerado no cliente: reenviar o mesmo check-in nunca cria um documento novo.
  newCheckInId() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) { /* usa o fallback */ }
    return `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  },

  // Itens enfileirados por versões antigas não têm clientId: o ID é derivado dos dados (determinístico).
  checkInDocId(userId, item) {
    if (item?.clientId) return String(item.clientId);
    const stamp = Date.parse(item?.date) || item?.queuedAt || 0;
    return `legacy-${userId}-${stamp}-${String(item?.trainingId || 'x').replace(/[^A-Za-z0-9_-]/g, '')}`;
  },

  saveOfflineCheckIn(userId, checkInPayload) {
    if (!userId || !checkInPayload) return;
    try {
      const key = `${OFFLINE_CHECKINS_PREFIX}${userId}`;
      const existing = this.getOfflineCheckIns(userId);
      const clientId = checkInPayload.clientId || this.newCheckInId();
      // Mesmo check-in enfileirado duas vezes (ex.: tentativa online que falhou e fila): mantém um só.
      if (existing.some((item) => item.clientId === clientId)) return;
      existing.push({
        ...checkInPayload,
        clientId,
        queuedAt: Date.now()
      });
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (err) {
      console.error('Erro ao armazenar check-in offline:', err);
    }
  },

  /**
   * Obtém a lista de check-ins pendentes offline.
   */
  getOfflineCheckIns(userId) {
    if (!userId) return [];
    try {
      const key = `${OFFLINE_CHECKINS_PREFIX}${userId}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Erro ao ler check-ins offline:', err);
      return [];
    }
  },

  /**
   * Limpa os check-ins pendentes já sincronizados.
   */
  clearOfflineCheckIns(userId) {
    if (!userId) return;
    try {
      const key = `${OFFLINE_CHECKINS_PREFIX}${userId}`;
      localStorage.removeItem(key);
    } catch (err) {
      console.error('Erro ao limpar check-ins offline:', err);
    }
  },

  /**
   * Sincroniza a fila de check-ins pendentes com o Firestore quando a rede é restabelecida.
   * Idempotente: cada item vai para o documento `checkIns/{clientId}` via setDoc, então um reenvio
   * (falha no meio da fila, duas abas, evento online repetido) sobrescreve o mesmo documento.
   * Cada item enviado sai da fila na hora, antes de tentar o próximo.
   */
  async syncPendingCheckIns(userId, db, setDoc, doc) {
    if (!userId || !db || !setDoc || !doc) return 0;
    if (this.syncing?.[userId]) return 0; // evita duas sincronizações simultâneas do mesmo usuário
    this.syncing = { ...(this.syncing || {}), [userId]: true };

    const key = `${OFFLINE_CHECKINS_PREFIX}${userId}`;
    let syncedCount = 0;
    try {
      let pending = this.getOfflineCheckIns(userId);
      for (const item of pending) {
        try {
          const { queuedAt, ...payload } = item;
          const id = this.checkInDocId(userId, item);
          await setDoc(doc(db, 'checkIns', id), { ...payload, clientId: id, syncedAt: new Date().toISOString() });
          syncedCount++;
          pending = pending.filter((entry) => entry !== item && this.checkInDocId(userId, entry) !== id);
          if (pending.length === 0) localStorage.removeItem(key);
          else localStorage.setItem(key, JSON.stringify(pending));
        } catch (err) {
          console.error('Falha ao enviar check-in offline pendente:', err);
        }
      }
    } finally {
      this.syncing = { ...(this.syncing || {}), [userId]: false };
    }
    return syncedCount;
  },

  /**
   * Síntese de áudio nativa via Web Audio API para notificar término de descanso.
   */
  playRestBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Nota A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Ignorar caso políticas de autoplay impeçam
    }
  }
};
