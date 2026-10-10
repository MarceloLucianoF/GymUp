import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { reloadOnceForChunkError } from '../../utils/chunkReload';

/**
 * Captura erros de renderização. Mostra mensagem amigável (sem stack) e registra no console.
 * Mude `resetKey` (ex.: pathname) para limpar o erro ao navegar.
 */
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Erro de renderização:', error, info?.componentStack);
    reloadOnceForChunkError(error);
  }

  componentDidUpdate(prev) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="flex min-h-[60vh] items-center justify-center bg-gray-50 p-6 text-center dark:bg-[#0B0F19]">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-800">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Algo deu errado</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Ocorreu um erro inesperado. Recarregue a página ou volte ao início. Seus dados não foram perdidos.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => window.location.reload()}
              className="min-h-[44px] rounded-xl bg-brand px-5 text-sm font-bold text-black hover:bg-brand-dark">
              Recarregar
            </button>
            <a href="/" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 px-5 text-sm font-bold text-gray-800 dark:border-white/20 dark:text-white">
              Voltar ao início
            </a>
          </div>
        </div>
      </div>
    );
  }
}
