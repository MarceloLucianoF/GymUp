import React, { useEffect, useId, useRef, useState } from 'react';

// Menu de ações de uma linha: botão com aria-haspopup, itens em role="menuitem", setas e Esc, fecha ao clicar fora.
export default function ActionMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();
  const visible = items.filter(Boolean);
  useEffect(() => {
    if (!open) return undefined;
    const buttons = () => [...ref.current.querySelectorAll('[role=menuitem]')];
    buttons()[0]?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); ref.current.querySelector('button[aria-haspopup]')?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = buttons(); const i = list.indexOf(document.activeElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
      }
    };
    const onDown = (e) => { if (!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  if (visible.length === 0) return <span className="muted small">-</span>;
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn ghost" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen((o) => !o)}>Ações</button>
      {open && (
        <ul id={id} role="menu" className="menu-list" aria-label={label}>
          {visible.map((it) => (
            <li key={it.label} role="none">
              <button type="button" role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick(); }}>{it.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
