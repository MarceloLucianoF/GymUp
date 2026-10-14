import React from 'react';
import { ASSIGNMENT_LABELS, ROLE_LABELS, STATUS_LABELS, friendlyError } from '../../../shared/academy-contracts/index.js';
import { initials } from '../lib/format';

export const RoleBadge = ({ role }) => <span className={`badge role-${role}`}>{ROLE_LABELS[role] || role}</span>;
export const StatusBadge = ({ status }) => <span className={`badge status-${status}`}>{STATUS_LABELS[status] || status}</span>;
export const AssignmentBadge = ({ status }) => <span className={`badge assign-${status}`}>{ASSIGNMENT_LABELS[status] || status}</span>;
export const Avatar = ({ name }) => <span className="avatar" aria-hidden="true">{initials(name)}</span>;

export function Loading({ text = 'Carregando...' }) {
  return <p role="status" className="muted loading"><span className="spinner" aria-hidden="true" />{text}</p>;
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="skeleton" role="status" aria-label="Carregando lista">
      {Array.from({ length: rows }, (_, i) => <span key={i} className="skeleton-row" />)}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="error-state">
      <p>{friendlyError(error)}</p>
      {error?.requestId && <p className="muted small">Código do atendimento: {error.requestId}</p>}
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Tentar de novo</button>}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginação">
      <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span aria-live="polite">Página {page} de {pages}</span>
      <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</button>
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Field({ id, label, hint, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="error" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  );
}
