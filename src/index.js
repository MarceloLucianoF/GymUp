import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import toast from 'react-hot-toast';
import { reloadOnceForChunkError } from './utils/chunkReload';

// Promessas rejeitadas sem tratamento: registra, recarrega 1x se for chunk antigo, senão toast discreto.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promessa rejeitada sem tratamento:', event.reason);
  if (reloadOnceForChunkError(event.reason)) return;
  toast('Algo não saiu como esperado. Tente novamente.', { id: 'unhandled-rejection', duration: 3000 });
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker (PWA): só em produção. O aviso de nova versão é exibido pelo UpdateBanner.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      window.__swRegistration = reg;
      window.dispatchEvent(new CustomEvent('sw:registered', { detail: reg }));
      if (reg.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent('sw:update', { detail: reg }));
      }
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('sw:update', { detail: reg }));
          }
        });
      });
    }).catch((err) => {
      console.warn('Falha ao registrar ServiceWorker:', err);
    });
  });
}
