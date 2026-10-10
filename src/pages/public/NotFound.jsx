import React from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta('Página não encontrada', 'A página que você procura não existe.', { noindex: true });
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gray-50 p-6 text-center dark:bg-[#0B0F19]">
      <div className="max-w-md">
        <p className="font-display text-7xl font-black text-brand" aria-hidden="true">404</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Página não encontrada</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">O endereço não existe ou foi movido.</p>
        <Link to="/" className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-6 text-sm font-bold text-black hover:bg-brand-dark">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
