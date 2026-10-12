/**
 * Service de Persistência de Treino Ativo e Fila Offline para o BohTreinar
 */

const ACTIVE_WORKOUT_PREFIX = 'academyup_active_workout_';
const OFFLINE_CHECKINS_PREFIX = 'academyup_pending_checkins_';

const QUEUE_EVENT = 'offline-queue-updated';
const SYNC_LOCK_PREFIX = 'academyup_sync_lock_';
const LOCK_TTL_MS = 30_000;
// Erros que repetir não resolve (regras negaram, dado inválido): o item fica marcado como falho até o usuário pedir de novo.
const PERMANENT_CODES = new Set(['permission-denied', 'invalid-argument', 'failed-precondition', 'unauthenticated']);

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
      this.notifyQueue(userId);
    } catch (err) {
      console.error('Erro ao armazenar check-in offline:', err);
    }
  },

  notifyQueue(userId) {
    try { window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: { userId } })); } catch (e) { /* sem window */ }
  },

  writeQueue(userId, list) {
    const key = `${OFFLINE_CHECKINS_PREFIX}${userId}`;
    if (list.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(list));
    this.notifyQueue(userId);
  },

  /** Tira um item da fila relendo o armazenamento: outra aba pode ter enfileirado treinos novos desde a leitura anterior. */
  dropFromQueue(userId, id) {
    this.writeQueue(userId, this.getOfflineCheckIns(userId).filter((entry) => this.checkInDocId(userId, entry) !== id));
  },

  /** Registra a falha no próprio item (tentativas e motivo) sem perder o treino. */
  noteFailure(userId, id, err) {
    const code = String(err?.code || '').replace(/^firestore\//, '');
    const list = this.getOfflineCheckIns(userId).map((entry) => (this.checkInDocId(userId, entry) !== id ? entry
      : { ...entry, attempts: (entry.attempts || 0) + 1, lastError: code || 'unknown', failedAt: Date.now(), permanent: PERMANENT_CODES.has(code) }));
    this.writeQueue(userId, list);
  },

  /** { total, failed }: failed são itens que a rede não resolve (precisam de ação do usuário). */
  queueStatus(userId) {
    const list = this.getOfflineCheckIns(userId);
    return { total: list.length, failed: list.filter((entry) => entry.permanent).length };
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
   * Cada item enviado sai da fila na hora, antes de tentar o próximo; falhas ficam no item (tentativas, motivo).
   */
  async syncPendingCheckIns(userId, db, setDoc, doc, saver = null, { force = false } = {}) {
    if (!userId || !db || (!saver && (!setDoc || !doc))) return 0;
    if (this.syncing?.[userId]) return 0; // evita duas sincronizações simultâneas do mesmo usuário
    if (!this.takeLock(userId)) return 0; // outra aba já está enviando
    this.syncing = { ...(this.syncing || {}), [userId]: true };
    this.notifyQueue(userId);

    let syncedCount = 0;
    try {
      for (const item of this.getOfflineCheckIns(userId)) {
        if (item.permanent && !force) continue; // falha definitiva: só volta a tentar quando o usuário pedir
        const id = this.checkInDocId(userId, item);
        try {
          const { queuedAt, attempts, lastError, failedAt, permanent, ...payload } = item;
          const data = { ...payload, clientId: id, syncedAt: new Date().toISOString() };
          if (saver) await saver(id, data); // grava e atualiza o contador (checkInService)
          else await setDoc(doc(db, 'checkIns', id), data);
          syncedCount++;
          this.dropFromQueue(userId, id);
        } catch (err) {
          console.error('Falha ao enviar check-in offline pendente:', err);
          this.noteFailure(userId, id, err);
        }
      }
    } finally {
      this.releaseLock(userId);
      this.syncing = { ...(this.syncing || {}), [userId]: false };
      this.notifyQueue(userId);
    }
    return syncedCount;
  },

  // Trava entre abas (localStorage, com validade): reduz envios em dobro; a idempotência do ID garante a correção mesmo assim.
  takeLock(userId) {
    try {
      const key = `${SYNC_LOCK_PREFIX}${userId}`;
      const held = Number(localStorage.getItem(key)) || 0;
      if (held && Date.now() - held < LOCK_TTL_MS) return false;
      localStorage.setItem(key, String(Date.now()));
    } catch (e) { /* sem localStorage: segue sem trava */ }
    return true;
  },

  releaseLock(userId) {
    try { localStorage.removeItem(`${SYNC_LOCK_PREFIX}${userId}`); } catch (e) { /* ignora */ }
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
