import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

// Região aria-live sempre montada, para leitores de tela anunciarem a mudança.
export default function OfflineBadge() {
  const online = useOnlineStatus();
  return (
    <div role="status" aria-live="polite" className={online ? 'sr-only' : 'fixed top-0 inset-x-0 z-[90] pointer-events-none'}>
      {!online && (
        <div className="mx-auto max-w-md flex items-center justify-center gap-2 bg-amber-500 text-black text-xs font-bold px-3 py-1.5 rounded-b-xl shadow">
          <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
          Você está offline — seus treinos serão sincronizados
        </div>
      )}
    </div>
  );
}
