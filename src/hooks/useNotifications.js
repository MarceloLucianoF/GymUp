import { useState, useCallback, useEffect } from 'react';

// Notificações LOCAIS (sem push de servidor): só disparam com o app aberto/em segundo plano
// recente. Não há agendamento em background no plano Spark.
export const DEFAULT_PREFS = {
  restDone: true,
  reminder: false,
  reminderTime: '18:00',
  vibrate: true,
  sound: true,
};

const keyFor = (uid) => `academyup:notif-prefs:${uid || 'anon'}`;

export const loadPrefs = (uid) => {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    return { ...DEFAULT_PREFS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (e) {
    return { ...DEFAULT_PREFS };
  }
};

const savePrefs = (uid, prefs) => {
  try { localStorage.setItem(keyFor(uid), JSON.stringify(prefs)); } catch (e) { /* ignore */ }
};

export const getPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

export const beep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => { if (ctx.close) ctx.close(); };
  } catch (e) { /* ignore */ }
};

export function useNotifications(uid) {
  const [prefs, setPrefs] = useState(() => loadPrefs(uid));
  const [permission, setPermission] = useState(getPermission);

  useEffect(() => { setPrefs(loadPrefs(uid)); }, [uid]);

  const updatePrefs = useCallback((patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(uid, next);
      return next;
    });
  }, [uid]);

  // Deve ser chamado a partir de um clique/toque do usuário.
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (e) {
      return getPermission();
    }
  }, []);

  const vibrate = useCallback((pattern = [200, 100, 200]) => {
    if (prefs.vibrate && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  }, [prefs.vibrate]);

  const playSound = useCallback(() => { if (prefs.sound) beep(); }, [prefs.sound]);

  const notify = useCallback(async (title, body, { tag } = {}) => {
    if (getPermission() !== 'granted') return false;
    const opts = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png', renotify: Boolean(tag) };
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, opts);
          return true;
        }
      }
      new Notification(title, opts); // eslint-disable-line no-new
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  return { prefs, updatePrefs, permission, supported: permission !== 'unsupported', requestPermission, notify, vibrate, playSound };
}

// Lembrete in-app: verdadeiro se está habilitado, já passou do horário e não há treino hoje.
export const shouldShowReminder = (prefs, hasWorkoutToday, now = new Date()) => {
  if (!prefs.reminder || hasWorkoutToday) return false;
  const [h, m] = String(prefs.reminderTime || '18:00').split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= (h || 0) * 60 + (m || 0);
};

export default useNotifications;
