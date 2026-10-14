import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { API_URL, auth } from './firebase';
import { ROLE_LABELS, MANAGEMENT_ROLES, createApi, friendlyError } from './api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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

function Home({ user }) {
  const api = useMemo(() => createApi({ baseUrl: API_URL, getToken: () => user.getIdToken() }), [user]);
  const [state, setState] = useState({ status: 'loading' });
  const load = () => {
    setState({ status: 'loading' });
    api.me().then((data) => setState({ status: 'ready', data })).catch((err) => setState({ status: 'error', message: friendlyError(err), requestId: err.requestId }));
  };
  useEffect(load, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = state.data?.memberships.filter((m) => MANAGEMENT_ROLES.includes(m.role) && m.status === 'active') || [];
  const onlyStudent = state.data && mine.length === 0;
  const [name, setName] = useState('');
  const [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const create = async (e) => {
    e.preventDefault();
    setCreating(true); setCreateError('');
    try {
      await api.createAcademy(name.trim(), attempt);
      setName(''); setAttempt(crypto.randomUUID());   // nova tentativa só depois do sucesso: repetir o envio reaproveita a chave
      load();
    } catch (err) { setCreateError(friendlyError(err)); } finally { setCreating(false); }
  };
  return (
    <main className="page">
      <header className="bar">
        <strong>BohTreinar Gestão</strong>
        <button className="ghost" onClick={() => signOut(auth)}>Sair</button>
      </header>
      {state.status === 'loading' && <p role="status">Carregando suas academias...</p>}
      {state.status === 'error' && (
        <div role="alert" className="card">
          <p>{state.message}</p>
          {state.requestId && <p className="muted">Código do atendimento: {state.requestId}</p>}
          <button onClick={load}>Tentar de novo</button>
        </div>
      )}
      {onlyStudent && (
        <div className="card">
          <h2>Nenhuma academia para gerir</h2>
          <p>Crie a sua academia abaixo, ou aceite um convite recebido. Alunos treinam no app BohTreinar.</p>
        </div>
      )}
      {mine.length > 0 && (
        <ul className="list" aria-label="Minhas academias">
          {mine.map((m) => (
            <li key={m.academyId} className="card">
              <h2>{m.academy?.name || 'Academia'}</h2>
              <p className="muted">{ROLE_LABELS[m.role]}{m.academy?.status === 'active' ? '' : ' · indisponível'}</p>
            </li>
          ))}
        </ul>
      )}
      {state.status === 'ready' && (
        <form className="card" onSubmit={create}>
          <h2>Criar academia</h2>
          <label htmlFor="academy-name">Nome da academia</label>
          <input id="academy-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required />
          {createError && <p role="alert" className="error">{createError}</p>}
          <button type="submit" disabled={creating || name.trim().length < 2}>{creating ? 'Criando...' : 'Criar academia'}</button>
        </form>
      )}
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <p role="status" className="center">Carregando...</p>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={user ? <Home user={user} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
