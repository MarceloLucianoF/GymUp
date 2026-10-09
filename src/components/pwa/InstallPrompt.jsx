import React from 'react';
import { Download, X, Share } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

export default function InstallPrompt() {
  const { visible, canInstall, install, dismiss } = useInstallPrompt();
  if (!visible) return null;

  return (
    <div role="region" aria-label="Instalar aplicativo" className="fixed bottom-24 inset-x-4 z-[85] mx-auto max-w-md rounded-2xl bg-white dark:bg-[#161b26] border border-gray-200 dark:border-white/10 shadow-xl p-4 flex items-start gap-3">
      <Download className="w-5 h-5 text-brand mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-gray-900 dark:text-white">Instale o AcademyUp</p>
        {canInstall ? (
          <>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Acesso rápido e treinos mesmo sem internet.</p>
            <button type="button" onClick={install} className="mt-2 min-h-[44px] px-4 rounded-xl bg-brand text-black text-sm font-black">Instalar</button>
          </>
        ) : (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Toque em <Share className="inline w-3.5 h-3.5 -mt-0.5" aria-label="Compartilhar" /> Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dispensar por 14 dias" className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center text-gray-500">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
