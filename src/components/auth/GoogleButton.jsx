import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthContext } from '../../hooks/AuthContext';

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

// Botão "Continuar com o Google" + aviso de aceite dos termos (o clique é o aceite).
export default function GoogleButton({ label = 'Continuar com o Google' }) {
  const { loginWithGoogle } = useAuthContext();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      toast.error(err.message || 'Não foi possível entrar com o Google.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
        className="pressable flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
      >
        <GoogleMark /> {busy ? 'Abrindo o Google...' : label}
      </button>
      <p className="text-center text-xs text-gray-600 dark:text-gray-400">
        Ao continuar com o Google, você aceita os{' '}
        <Link to="/termos" target="_blank" rel="noopener noreferrer" className="underline">Termos de Uso</Link> e a{' '}
        <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className="underline">Política de Privacidade</Link>.
      </p>
    </div>
  );
}

export const OrDivider = () => (
  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400" aria-hidden="true">
    <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" /> ou <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
  </div>
);
