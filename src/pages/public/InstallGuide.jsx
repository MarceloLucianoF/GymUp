import React from 'react';
import { Link } from 'react-router-dom';
import { Share, SquarePlus, Smartphone, MoreVertical, Download } from 'lucide-react';
import usePageMeta from '../../hooks/usePageMeta';
import { isInAppBrowser, isIos, isStandalone } from '../../hooks/useInstallPrompt';
import { BrandMark, BrandWordmark } from '../../components/brand/Brand';

// Passo a passo para instalar o BohTreinar como aplicativo (PWA). No iPhone e no iPad não existe botão de instalar: é pelo Safari.
const IOS_STEPS = [
  { icon: Smartphone, title: 'Abra no Safari', text: 'Entre em bohtreinar.marcelo-labs.workers.dev no Safari. Em outros navegadores (Chrome, Instagram, WhatsApp) o caminho pode não aparecer.' },
  { icon: Share, title: 'Toque em Compartilhar', text: 'É o quadrado com uma seta para cima, na barra de baixo (iPhone) ou no topo (iPad).' },
  { icon: SquarePlus, title: 'Adicionar à Tela de Início', text: 'Role a lista de opções, toque em "Adicionar à Tela de Início" e confirme em "Adicionar".' }
];
const ANDROID_STEPS = [
  { icon: MoreVertical, title: 'Abra o menu do Chrome', text: 'Toque nos três pontos, no canto superior direito.' },
  { icon: Download, title: 'Instalar aplicativo', text: 'Toque em "Instalar aplicativo" (ou "Adicionar à tela inicial") e confirme.' }
];

function Steps({ steps, label }) {
  return (
    <ol aria-label={label} className="mt-4 space-y-3">
      {steps.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-amber-800 dark:text-brand"><Icon className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h3 className="font-display text-base font-black">{title}</h3>
            <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function InstallGuide() {
  usePageMeta('Instalar o BohTreinar', 'Como instalar o BohTreinar no iPhone, iPad e Android: abra no Safari, toque em Compartilhar e em Adicionar à Tela de Início.');
  const standalone = isStandalone();
  const inApp = isInAppBrowser();
  const ios = isIos();
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#0B0F19] dark:text-gray-100">
      <header className="border-b border-gray-200/70 bg-white dark:border-white/10 dark:bg-[#0B0F19]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="BohTreinar início">
            <BrandMark className="h-9 w-9 rounded-xl" />
            <span className="font-display text-lg font-black"><BrandWordmark /></span>
          </Link>
          <Link to="/register" className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 text-sm font-black text-black">Criar conta</Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 outline-none">
        <h1 className="font-display text-3xl font-black sm:text-4xl">Instale o BohTreinar no celular</h1>
        <p className="mt-2 text-gray-700 dark:text-gray-300">O BohTreinar é um aplicativo web: depois de instalado, abre pelo ícone na tela inicial, em tela cheia, e continua funcionando sem sinal na academia. Não precisa de loja de aplicativos.</p>

        {standalone && <p role="status" className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200">Você já está usando o BohTreinar instalado.</p>}
        {inApp && <p role="alert" className="mt-4 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">Você está num navegador dentro de outro aplicativo, que não instala. Toque nos três pontos ou no ícone de compartilhar e escolha &quot;Abrir no navegador&quot;.</p>}

        <section aria-labelledby="ios" className={ios ? 'mt-8' : 'mt-8 order-2'}>
          <h2 id="ios" className="font-display text-2xl font-black">iPhone e iPad</h2>
          <Steps steps={IOS_STEPS} label="Passos no iPhone e iPad" />
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">Depois de instalar, abra sempre pelo ícone da tela inicial. Notificações do navegador e a tela sempre ligada durante o treino dependem da versão do iOS (16.4 ou mais nova).</p>
        </section>
        <section aria-labelledby="android" className="mt-10">
          <h2 id="android" className="font-display text-2xl font-black">Android</h2>
          <Steps steps={ANDROID_STEPS} label="Passos no Android" />
        </section>
        <p className="mt-10 text-sm"><Link to="/" className="font-bold underline">Voltar ao início</Link></p>
      </main>
    </div>
  );
}
