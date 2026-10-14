import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { useSession } from '../session';
import { safeNext } from '../policy';

export default function Login() {
  const { user } = useSession();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={next} replace />;
  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch { setError('Não foi possível entrar. Confira os dados e tente de novo.'); } finally { setBusy(false); }
  };
  return (
    <main className="center">
      <form className="card" onSubmit={(e) => { e.preventDefault(); run(() => signInWithEmailAndPassword(auth, email, password)); }}>
        <h1>BohTreinar Gestão</h1>
        <p className="muted">Entre com a mesma conta do BohTreinar.</p>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Senha</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}>Entrar com Google</button>
      </form>
    </main>
  );
}
