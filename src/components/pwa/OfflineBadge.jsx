import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';

const plural = (n) => `${n} ${n === 1 ? 'treino' : 'treinos'}`;

// Estado da conexão e da fila de treinos: offline, pendente, sincronizando ou com falha. Região aria-live sempre montada.
export default function OfflineBadge() {
  const { user } = useAuthContext();
  const { online, total, failed, syncing, retry } = useOfflineSync(user);
  const waiting = total - failed;

  let tone = null;
  let content = null;
  if (failed > 0) {
    tone = 'bg-rose-600 text-white';
    content = (
      <>
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{plural(failed)} não {failed === 1 ? 'foi enviado' : 'foram enviados'}.</span>
        <button type="button" onClick={retry} className="pointer-events-auto underline font-black min-h-[24px]">Tentar de novo</button>
      </>
    );
  } else if (!online) {
    tone = 'bg-amber-500 text-black';
    content = (
      <>
        <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {waiting > 0 ? `Sem conexão — ${plural(waiting)} aguardando para sincronizar` : 'Você está offline — seus treinos serão sincronizados'}
      </>
    );
  } else if (waiting > 0) {
    tone = 'bg-amber-500 text-black';
    content = (
      <>
        <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
        {syncing ? `Sincronizando ${plural(waiting)}...` : `${plural(waiting)} aguardando sincronização`}
      </>
    );
  }

  return (
    <div role="status" aria-live="polite" className={content ? 'fixed top-0 inset-x-0 z-[90] pointer-events-none' : 'sr-only'}>
      {content && (
        <div className={`mx-auto max-w-md flex items-center justify-center gap-2 ${tone} text-xs font-bold px-3 py-1.5 rounded-b-xl shadow`}>
          {content}
        </div>
      )}
    </div>
  );
}
