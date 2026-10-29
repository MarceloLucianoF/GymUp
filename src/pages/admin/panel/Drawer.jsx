import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { iconBtn } from '../../../components/coach/styles';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

// Painel lateral (tela inteira no celular). Esc e clique fora fecham; o foco volta ao elemento de origem.
export default function Drawer({ title, subtitle, onClose, children, footer }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useBodyScrollLock();

  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex h-[100dvh] w-full flex-col bg-white outline-none dark:bg-[#0F1420] sm:max-w-2xl sm:rounded-l-3xl sm:border-l sm:border-white/10"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-black text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar painel" className={iconBtn}><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-gray-200 px-5 py-3 dark:border-white/10" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{footer}</footer>}
      </div>
    </div>
  );
}
