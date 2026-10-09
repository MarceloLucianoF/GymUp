import React, { useEffect, useRef } from 'react';

// Modal base acessível: role="dialog", fecha com Esc/clique fora, devolve o foco ao fechar.
export default function Modal({ onClose, label, children, className = '' }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose; // evita refocar a cada render quando onClose é inline

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
