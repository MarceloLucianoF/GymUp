// Controles do treino na tela de bloqueio e na notificação de mídia (Android/Chrome, e no relógio pareado, que espelha a notificação).
// A notificação de mídia só existe enquanto há áudio tocando; por isso um áudio silencioso fica em repetição durante o treino.
// Os botões do sistema viram ações do treino: anterior = voltar série, próximo = concluir série, play/pausa = pular o descanso,
// avançar e voltar = próximo e exercício anterior. Só liga quando o aluno ativa (tocar a música de outro app pode pausar).
import { useEffect, useRef } from 'react';

export const mediaSessionSupported = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof window !== 'undefined' && typeof window.MediaMetadata === 'function';

/** 1 segundo de silêncio em WAV (8 kHz, 8 bits, mono), montado em código para não carregar arquivo. */
export function silentWavBlob() {
  const rate = 8000; const n = rate;
  const buf = new ArrayBuffer(44 + n); const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i += 1) v.setUint8(44 + i, 128);   // 128 = silêncio em 8 bits sem sinal
  return new Blob([buf], { type: 'audio/wav' });
}

const ACTIONS = ['previoustrack', 'nexttrack', 'play', 'pause', 'seekbackward', 'seekforward'];

/**
 * @param enabled   liga e desliga tudo
 * @param meta      { title, artist, album, artwork } da tela atual (atualiza sozinho)
 * @param handlersRef ref com { previoustrack, nexttrack, play, pause, seekbackward, seekforward } (sempre a versão mais nova)
 */
export function useWorkoutMediaSession({ enabled, meta, handlersRef }) {
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  useEffect(() => {
    if (!enabled || !mediaSessionSupported()) return undefined;
    const ms = navigator.mediaSession;
    const url = URL.createObjectURL(silentWavBlob());
    urlRef.current = url;
    const audio = new Audio(url);
    audio.loop = true;
    audioRef.current = audio;
    audio.play().catch(() => { /* sem gesto do usuário o navegador recusa; o botão de ativar já é um gesto */ });
    ACTIONS.forEach((a) => {
      try {
        ms.setActionHandler(a, () => {
          handlersRef.current?.[a]?.();
          if (a === 'pause' || a === 'play') audio.play().catch(() => {});   // mantém a sessão viva
        });
      } catch (e) { /* ação não suportada neste navegador */ }
    });
    ms.playbackState = 'playing';
    // se o navegador recusou o áudio por falta de gesto (controle já ligado ao abrir a tela), tenta de novo no primeiro toque
    const retry = () => { audio.play().catch(() => {}); };
    window.addEventListener('pointerdown', retry, { once: true });
    return () => {
      window.removeEventListener('pointerdown', retry);
      try { audio.pause(); } catch (e) { /* ignora */ }
      ACTIONS.forEach((a) => { try { ms.setActionHandler(a, null); } catch (e) { /* ignora */ } });
      try { ms.metadata = null; ms.playbackState = 'none'; } catch (e) { /* ignora */ }
      URL.revokeObjectURL(url);
      audioRef.current = null; urlRef.current = null;
    };
  }, [enabled, handlersRef]);

  useEffect(() => {
    if (!enabled || !mediaSessionSupported() || !meta) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: String(meta.title || 'Treino').slice(0, 80),
        artist: String(meta.artist || '').slice(0, 80),
        album: String(meta.album || 'BohTreinar').slice(0, 80),
        artwork: meta.artwork ? [{ src: meta.artwork, sizes: '360x360', type: 'image/jpeg' }] : []
      });
    } catch (e) { /* metadado inválido: a sessão segue sem capa */ }
  }, [enabled, meta?.title, meta?.artist, meta?.album, meta?.artwork]);   // eslint-disable-line react-hooks/exhaustive-deps
}
