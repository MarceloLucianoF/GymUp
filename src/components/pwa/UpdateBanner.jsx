import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Escuta 'sw:update' (disparado em src/index.js quando há SW novo em espera).
export default function UpdateBanner() {
  const [reg, setReg] = useState(null);

  useEffect(() => {
    const onUpdate = (e) => setReg(e.detail);
    window.addEventListener('sw:update', onUpdate);
    return () => window.removeEventListener('sw:update', onUpdate);
  }, []);

  if (!reg) return null;

  const update = () => {
    if (!reg.waiting) { window.location.reload(); return; }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <div role="alert" className="fixed bottom-24 inset-x-4 z-[90] mx-auto max-w-md flex items-center justify-between gap-3 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-xl border border-white/10">
      <span className="text-sm font-bold">Nova versão disponível</span>
      <button type="button" onClick={update} className="min-h-[44px] px-4 rounded-xl bg-brand text-black text-sm font-black flex items-center gap-1.5">
        <RefreshCw className="w-4 h-4" aria-hidden="true" /> Atualizar
      </button>
    </div>
  );
}
