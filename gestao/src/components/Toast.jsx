import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

// Avisos curtos: aria-live para leitores de tela; somem sozinhos; erro dura mais.
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const push = useCallback((message, kind = 'ok') => {
    const id = ++seq.current;
    setItems((list) => [...list.slice(-3), { id, message, kind }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  useEffect(() => () => { seq.current = 0; }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="region" aria-label="Avisos" aria-live="polite">
        {items.map((t) => <p key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>{t.message}</p>)}
      </div>
    </Ctx.Provider>
  );
}
