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

// Registro do Service Worker PWA para suporte offline e instalabilidade
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('AcademyUp ServiceWorker registrado com sucesso:', reg.scope);
    }).catch((err) => {
      console.warn('Falha ao registrar ServiceWorker:', err);
    });
  });
}