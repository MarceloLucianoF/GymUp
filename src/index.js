import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

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
