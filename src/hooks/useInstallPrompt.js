import { useState, useEffect, useCallback } from 'react';

export const DISMISS_KEY = 'academyup:install-dismissed-at';
export const DISMISS_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };

export const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false;
  return Boolean(mm || window.navigator.standalone);
};

export const isIos = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Navegador embutido de outro aplicativo (Instagram, Facebook, WhatsApp etc.): não tem "Adicionar à Tela de Início".
export const isInAppBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|; wv\)/i.test(navigator.userAgent || '');
};

export const isIosSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos() && safari && !isInAppBrowser();
};

export const wasDismissedRecently = (now = Date.now()) => {
  const at = Number(safeGet(DISMISS_KEY));
  return Boolean(at) && now - at < DISMISS_DAYS * DAY_MS;
};

// Controla o convite de instalação do PWA.
// canInstall: Chrome/Android (prompt nativo). showIosHelp: iOS Safari (instrução manual).
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => wasDismissedRecently());
  const ios = isIos();
  const iosSafari = isIosSafari();
  const inApp = isInAppBrowser();

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return 'unavailable';
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice && choice.outcome === 'accepted') setInstalled(true);
    return choice ? choice.outcome : 'dismissed';
  }, [deferred]);

  const dismiss = useCallback(() => {
    safeSet(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  const canInstall = Boolean(deferred) && !installed;
  // iPhone e iPad não têm botão de instalar: o caminho é Compartilhar, Adicionar à Tela de Início. Em navegador embutido, abrir no Safari.
  const showIosHelp = ios && !installed;
  const visible = !installed && !dismissed && (canInstall || showIosHelp || (inApp && !installed));

  return { canInstall, showIosHelp, iosSafari, inApp, installed, dismissed, visible, install, dismiss };
}

export default useInstallPrompt;
