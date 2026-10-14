import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MANAGEMENT_ROLES, ROLE_LABELS, friendlyError } from '../api';
import { useApi, useSession } from '../session';
import { ErrorBox, Loading, Shell } from './Shell';

export default function Home() {
  const { api } = useSession();
  const [state, reload] = useApi(() => api.me(), [api]);
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
      reload();
    } catch (err) { setCreateError(friendlyError(err)); } finally { setCreating(false); }
  };
  const mine = state.data?.memberships.filter((m) => MANAGEMENT_ROLES.includes(m.role) && m.status === 'active') || [];
  return (
    <Shell>
      {state.status === 'loading' && <Loading text="Carregando suas academias..." />}
      {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
      {state.status === 'ready' && mine.length === 0 && (
        <div className="card">
          <h2>Nenhuma academia para gerir</h2>
          <p>Crie a sua academia abaixo, ou aceite um convite recebido. Alunos treinam no app BohTreinar.</p>
        </div>
      )}
      {mine.length > 0 && (
        <ul className="list" aria-label="Minhas academias">
          {mine.map((m) => {
            const usable = m.academy?.status === 'active';
            return (
              <li key={m.academyId} className="card">
                <h2>{usable ? <Link to={`/academia/${m.academyId}`} className="card-link">{m.academy.name}</Link> : m.academy?.name || 'Academia'}</h2>
                <p className="muted">{ROLE_LABELS[m.role]}{usable ? '' : ' · indisponível'}</p>
              </li>
            );
          })}
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
    </Shell>
  );
}
