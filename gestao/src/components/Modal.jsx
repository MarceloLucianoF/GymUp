import React, { useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo acessível: foco preso dentro, Esc fecha, devolve o foco a quem abriu, rola a página por trás travada.
export default function Modal({ title, children, onClose, busy = false, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    const node = ref.current;
    const first = node.querySelector('[data-autofocus]') || node.querySelector(FOCUSABLE);
    first?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const a = items[0]; const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; opener?.focus?.(); };
  }, [busy, onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Confirmação de ação sensível: diz o que vai acontecer, pede confirmação explícita e mostra o resultado de erro sem fechar. */
export function ConfirmModal({ title, children, confirmLabel, danger = false, onConfirm, onClose, error, busy }) {
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <div className="modal-body">{children}</div>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" className={`btn ${danger ? 'danger-fill' : 'primary'}`} onClick={onConfirm} disabled={busy} data-autofocus>{busy ? 'Aplicando...' : confirmLabel}</button>
      </div>
    </Modal>
  );
}
