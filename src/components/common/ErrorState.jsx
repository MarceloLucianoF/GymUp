import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ message = 'Não foi possível carregar os dados.', onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center text-center py-12 px-6">
      <AlertTriangle className="w-12 h-12 mb-4 text-red-500" aria-hidden="true" />
      <p className="font-bold text-gray-700 dark:text-gray-200">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand-dark text-black transition-colors"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
