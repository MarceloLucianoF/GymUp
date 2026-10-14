import React from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { friendlyError } from '../api';

export function Shell({ children, back }) {
  return (
    <main className="page">
      <header className="bar">
        <span className="bar-left">
          {back && <Link to={back.to} className="link">{back.label}</Link>}
          <strong>BohTreinar Gestão</strong>
        </span>
        <button className="ghost" onClick={() => signOut(auth)}>Sair</button>
      </header>
      {children}
    </main>
  );
}

export function Loading({ text = 'Carregando...' }) { return <p role="status" className="muted">{text}</p>; }

export function ErrorBox({ error, onRetry }) {
  return (
    <div role="alert" className="card">
      <p>{friendlyError(error)}</p>
      {error?.requestId && <p className="muted">Código do atendimento: {error.requestId}</p>}
      {onRetry && <button onClick={onRetry}>Tentar de novo</button>}
    </div>
  );
}
