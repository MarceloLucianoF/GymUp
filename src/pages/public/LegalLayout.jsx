import React from 'react';
import { Link } from 'react-router-dom';
import { BrandMark, BrandWordmark } from '../../components/brand/Brand';

export const CONTACT_EMAIL = 'contato@bohtreinar.app';

export default function LegalLayout({ title, updatedAt, children }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#0B0F19] dark:text-gray-100">
      <header className="border-b border-gray-200/70 bg-white/80 dark:border-white/10 dark:bg-[#0B0F19]/80">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="BohTreinar início">
            <BrandMark className="h-9 w-9 rounded-xl" />
            <span className="font-display text-lg font-black"><BrandWordmark /></span>
          </Link>
          <nav aria-label="Documentos legais" className="flex gap-4 text-sm font-bold">
            <Link to="/privacidade" className="min-h-[44px] inline-flex items-center hover:text-brand">Privacidade</Link>
            <Link to="/termos" className="min-h-[44px] inline-flex items-center hover:text-brand">Termos</Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 outline-none">
        <h1 className="font-display text-3xl font-black sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Última atualização: {updatedAt}</p>
        <p role="note" className="mt-4 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
          Documento modelo, a ser revisado por advogado antes da publicação definitiva. O e-mail de contato ({CONTACT_EMAIL}) está a confirmar.
        </p>
        <div className="legal-body mt-8 space-y-8 text-[15px] leading-relaxed text-gray-800 dark:text-gray-200">{children}</div>
      </main>
      <footer className="border-t border-gray-200/70 py-6 text-center text-xs text-gray-600 dark:border-white/10 dark:text-gray-300">
        <Link to="/" className="font-bold hover:text-brand">Voltar ao BohTreinar</Link>
      </footer>
    </div>
  );
}

export const Section = ({ title, children }) => (
  <section>
    <h2 className="font-display text-xl font-black text-gray-900 dark:text-white">{title}</h2>
    <div className="mt-2 space-y-3">{children}</div>
  </section>
);
