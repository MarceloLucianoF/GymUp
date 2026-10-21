import { renderHook } from '@testing-library/react';
import { mediaSessionSupported, silentWavBlob, useWorkoutMediaSession } from './useWorkoutMediaSession';

function installMediaSession() {
  const handlers = {};
  const ms = { metadata: null, playbackState: 'none', setActionHandler: jest.fn((a, fn) => { if (fn) handlers[a] = fn; else delete handlers[a]; }) };
  Object.defineProperty(global.navigator, 'mediaSession', { value: ms, configurable: true });
  global.MediaMetadata = function MediaMetadata(init) { Object.assign(this, init); };
  window.MediaMetadata = global.MediaMetadata;
  const plays = [];
  global.Audio = function Audio(src) { this.src = src; this.loop = false; this.play = () => { plays.push(src); return Promise.resolve(); }; this.pause = jest.fn(); };
  global.URL.createObjectURL = jest.fn(() => 'blob:silencio');
  global.URL.revokeObjectURL = jest.fn();
  return { ms, handlers, plays };
}

afterEach(() => { delete global.navigator.mediaSession; delete global.MediaMetadata; delete window.MediaMetadata; });

test('suporte só existe com a API e o MediaMetadata', () => {
  expect(mediaSessionSupported()).toBe(false);
  installMediaSession();
  expect(mediaSessionSupported()).toBe(true);
});

test('o silêncio é um WAV válido de 1 segundo', async () => {
  const blob = silentWavBlob();
  expect(blob.type).toBe('audio/wav');
  expect(blob.size).toBe(44 + 8000);
  const bytes = new Uint8Array(await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsArrayBuffer(blob); }));
  expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
  expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
  expect(bytes.slice(44).every((b) => b === 128)).toBe(true);
});

test('ligado: toca o silêncio, registra os botões, mostra o exercício e chama a versão mais nova das ações', () => {
  const { ms, handlers, plays } = installMediaSession();
  const handlersRef = { current: { nexttrack: jest.fn(), previoustrack: jest.fn(), pause: jest.fn() } };
  const { rerender } = renderHook(({ meta }) => useWorkoutMediaSession({ enabled: true, meta, handlersRef }), { initialProps: { meta: { title: 'Supino Reto Máquina', artist: 'Série 1 de 3 · Meta 3 x 8-12', album: 'Superiores A', artwork: 'https://x/y.jpg' } } });
  expect(plays).toEqual(['blob:silencio']);
  expect(ms.playbackState).toBe('playing');
  expect(ms.metadata).toMatchObject({ title: 'Supino Reto Máquina', artist: 'Série 1 de 3 · Meta 3 x 8-12', album: 'Superiores A' });
  expect(ms.metadata.artwork[0].src).toBe('https://x/y.jpg');
  handlers.nexttrack();
  expect(handlersRef.current.nexttrack).toHaveBeenCalledTimes(1);
  handlersRef.current = { ...handlersRef.current, nexttrack: jest.fn() };       // nova versão da ação (estado novo)
  handlers.nexttrack();
  expect(handlersRef.current.nexttrack).toHaveBeenCalledTimes(1);
  handlers.pause();
  expect(handlersRef.current.pause).toHaveBeenCalled();
  expect(plays.length).toBe(2);                                                   // o áudio volta a tocar depois de pausar
  rerender({ meta: { title: 'Remada', artist: 'Série 2 de 3', album: 'Superiores A', artwork: null } });
  expect(ms.metadata.title).toBe('Remada');
  expect(ms.metadata.artwork).toEqual([]);
});

test('desligar limpa tudo: sem botões, sem metadado, áudio parado e URL liberada', () => {
  const { ms, handlers } = installMediaSession();
  const handlersRef = { current: {} };
  const { unmount } = renderHook(() => useWorkoutMediaSession({ enabled: true, meta: { title: 'A' }, handlersRef }));
  expect(Object.keys(handlers).length).toBe(6);
  unmount();
  expect(Object.keys(handlers).length).toBe(0);
  expect(ms.metadata).toBeNull();
  expect(ms.playbackState).toBe('none');
  expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:silencio');
});

test('desativado ou sem suporte não faz nada', () => {
  const { ms, plays } = installMediaSession();
  renderHook(() => useWorkoutMediaSession({ enabled: false, meta: { title: 'A' }, handlersRef: { current: {} } }));
  expect(plays).toEqual([]);
  expect(ms.setActionHandler).not.toHaveBeenCalled();
  delete global.navigator.mediaSession;
  expect(() => renderHook(() => useWorkoutMediaSession({ enabled: true, meta: { title: 'A' }, handlersRef: { current: {} } }))).not.toThrow();
});
