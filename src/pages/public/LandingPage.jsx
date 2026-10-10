import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import usePageMeta, { SITE_URL } from '../../hooks/usePageMeta';
import {
  Dumbbell, Flame, Sparkles, LineChart, MessageCircle, Timer, Users, Wallet, ClipboardList,
  ArrowRight, Check, Play, Smartphone, WifiOff, Trophy, Zap
} from 'lucide-react';
import { useAuthContext } from '../../hooks/AuthContext';
import Reveal from '../../components/ui/Reveal';
import ProgressRing from '../../components/ui/ProgressRing';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import { BrandMark, BrandWordmark } from '../../components/brand/Brand';

const FEATURES = [
  { icon: Timer, title: 'Treino guiado', text: 'Cronômetro, descanso automático e registro de carga série a série, pensado para usar com uma mão.' },
  { icon: LineChart, title: 'Evolução real', text: 'Gráficos de carga, volume e medidas mostram o progresso que a balança sozinha não conta.' },
  { icon: Sparkles, title: 'Coach com IA', text: 'Pergunte, receba macros e peça uma ficha pronta. A IA conhece o seu histórico.' },
  { icon: MessageCircle, title: 'Chat com o treinador', text: 'Dúvidas e ajustes sem sair do app, com o contexto do treino ao lado.' },
  { icon: WifiOff, title: 'Funciona offline', text: 'Sem sinal na academia? Seu treino é salvo e sincronizado quando a rede voltar.' },
  { icon: Trophy, title: 'Metas e recordes', text: 'Sequência de dias, meta semanal e aviso de novos recordes pessoais.' }
];

const STEPS = [
  { n: '01', title: 'Crie sua conta', text: 'Em menos de um minuto, sem cartão.' },
  { n: '02', title: 'Receba sua ficha', text: 'Do treinador ou gerada pela IA.' },
  { n: '03', title: 'Treine e evolua', text: 'Registre, acompanhe e bata recordes.' }
];

const COACH_POINTS = [
  { icon: Users, text: 'Carteira de alunos com status e alertas de risco' },
  { icon: ClipboardList, text: 'Editor de fichas e biblioteca de exercícios' },
  { icon: Wallet, text: 'Financeiro com mensalidades e inadimplência' },
  { icon: MessageCircle, text: 'Chat integrado com cada aluno' }
];

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] animate-float sm:w-[290px]" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[3rem] bg-brand/30 blur-3xl" />
      <div className="relative rounded-[2.4rem] border border-white/10 bg-gray-950 p-2.5 shadow-2xl ring-1 ring-black/40">
        <div className="rounded-[1.9rem] bg-gradient-to-b from-[#FFF8E1] to-white p-4 dark:from-[#1a1608] dark:to-[#0B0F19]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Bom dia</p>
              <p className="font-display text-lg font-black text-gray-900 dark:text-white">Ana</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-black text-orange-500"><Flame className="h-3.5 w-3.5" /> 12</span>
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white/80 p-3 dark:bg-white/5">
            <ProgressRing value={75} size={64} stroke={7}><span className="text-sm font-black text-gray-900 dark:text-white">3/4</span></ProgressRing>
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">Meta semanal</p>
              <p className="text-xs text-gray-500">Falta 1 treino</p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-gradient-to-br from-brand to-[#FF9800] p-4 text-black">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Treino de hoje</p>
            <p className="mt-1 font-display text-base font-black leading-tight">Peito e Tríceps</p>
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-black py-2.5 text-xs font-black text-brand"><Play className="h-3.5 w-3.5 fill-current" /> INICIAR</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/80 p-2.5 dark:bg-white/5"><p className="font-display text-lg font-black text-gray-900 dark:text-white">18</p><p className="text-[10px] uppercase text-gray-500">treinos</p></div>
            <div className="rounded-xl bg-white/80 p-2.5 dark:bg-white/5"><p className="font-display text-lg font-black text-gray-900 dark:text-white">52t</p><p className="text-[10px] uppercase text-gray-500">volume</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'BohTreinar',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web, Android, iOS (PWA)',
  url: SITE_URL,
  description: 'App de treinos com fichas, cronômetro, evolução, chat com o treinador e Coach de IA.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' }
};

export default function LandingPage() {
  usePageMeta('Treine. Evolua. Supere.', 'BohTreinar: fichas, cronômetro, evolução, chat com o treinador e Coach de IA. Funciona offline e é grátis para começar.');
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      try {
        setActiveSession(activeWorkoutService.getActiveSession(user.uid));
      } catch {
        setActiveSession(null);
      }
    } else {
      setActiveSession(null);
    }
  }, [user]);

  const goPrimary = () => navigate(user ? '/dashboard' : '/register');
  const continueWorkout = () => navigate(`/execution/${activeSession.trainingId}`);

  return (
    <div className="min-h-screen overflow-x-clip bg-gray-50 text-gray-900 dark:bg-[#0B0F19] dark:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0F19]/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <button type="button" onClick={() => navigate('/')} className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="BohTreinar início">
            <BrandMark className="h-10 w-10 shrink-0 rounded-xl shadow-sm" />
            <span className="font-display text-lg font-black tracking-tight sm:text-xl"><BrandWordmark /></span>
          </button>
          <nav className="flex shrink-0 items-center gap-2" aria-label="Acesso">
            {user ? (
              <>
                {activeSession && (
                  <button type="button" onClick={continueWorkout} className="pressable hidden min-h-[44px] items-center gap-1.5 rounded-xl bg-orange-500/15 px-3 text-sm font-bold text-orange-500 sm:flex">
                    <Flame className="h-4 w-4" /> Continuar treino
                  </button>
                )}
                <button type="button" onClick={() => navigate('/dashboard')} className="pressable min-h-[44px] rounded-xl bg-brand px-4 text-sm font-black text-black shadow-lg shadow-brand/30">Meu painel</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => navigate('/login')} className="pressable min-h-[44px] rounded-xl px-3 text-sm font-bold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">Entrar</button>
                <button type="button" onClick={() => navigate('/register')} className="pressable min-h-[44px] rounded-xl bg-brand px-4 text-sm font-black text-black shadow-lg shadow-brand/30">Começar</button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {/* HERO */}
        <section className="aurora-bg relative">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-8 lg:pb-24 lg:pt-24">
            <div className="text-center lg:text-left">
              <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-brand">
                <Zap className="h-3.5 w-3.5" /> Treino inteligente para quem leva a sério
              </span>
              <h1 className="animate-fade-up mt-5 font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl" style={{ animationDelay: '80ms' }}>
                Treine com <span className="text-gradient-brand">método.</span><br />Evolua com <span className="text-gradient-brand">dados.</span>
              </h1>
              <p className="animate-fade-up mx-auto mt-5 max-w-xl text-base text-gray-600 dark:text-gray-300 sm:text-lg lg:mx-0" style={{ animationDelay: '160ms' }}>
                Fichas, cronômetro, evolução, chat com o treinador e um coach de IA. Tudo num app feito para usar com uma mão, mesmo sem internet.
              </p>
              <div className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start" style={{ animationDelay: '240ms' }}>
                {activeSession ? (
                  <button type="button" onClick={continueWorkout} className="pressable animate-pulse-ring flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-[#FF9800] px-7 text-base font-black text-black shadow-xl shadow-brand/30">
                    <Flame className="h-5 w-5" /> Continuar treino ativo
                  </button>
                ) : (
                  <button type="button" onClick={goPrimary} className="pressable flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-[#FF9800] px-7 text-base font-black text-black shadow-xl shadow-brand/30">
                    {user ? 'Ir para meu painel' : 'Criar conta grátis'} <ArrowRight className="h-5 w-5" />
                  </button>
                )}
                <button type="button" onClick={() => navigate(user ? '/trainings' : '/login')} className="pressable flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white/70 px-7 text-base font-bold text-gray-800 backdrop-blur dark:border-white/15 dark:bg-white/5 dark:text-white">
                  {user ? 'Ver minhas fichas' : 'Já tenho conta'}
                </button>
              </div>
              <dl className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 text-center lg:mx-0 lg:text-left">
                {[['Offline', 'funciona sem rede'], ['Coach IA', 'macros e fichas'], ['Chat', 'com seu treinador']].map(([t, l]) => (
                  <div key={t}>
                    <dt className="font-display text-xl font-black text-gray-900 dark:text-white">{t}</dt>
                    <dd className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="animate-scale-in" style={{ animationDelay: '200ms' }}><PhoneMockup /></div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20" aria-labelledby="features-title">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Tudo em um lugar</p>
            <h2 id="features-title" className="mt-2 font-display text-3xl font-black sm:text-4xl">Menos planilha, mais resultado</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Cada detalhe foi pensado para o momento em que você está com o celular na mão entre uma série e outra.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 70}>
                <article className="surface surface-hover h-full p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                  <h3 className="mt-4 font-display text-lg font-black">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="border-y border-gray-200/70 bg-white/60 py-16 dark:border-white/10 dark:bg-white/[0.02]" aria-labelledby="steps-title">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal className="text-center">
              <h2 id="steps-title" className="font-display text-3xl font-black sm:text-4xl">Comece em 3 passos</h2>
            </Reveal>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={i * 100} as="li">
                  <div className="surface h-full p-6">
                    <span className="font-display text-4xl font-black text-gradient-brand">{step.n}</span>
                    <h3 className="mt-2 font-display text-lg font-black">{step.title}</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{step.text}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* PARA TREINADORES */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20" aria-labelledby="coach-title">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Para treinadores</p>
              <h2 id="coach-title" className="mt-2 font-display text-3xl font-black sm:text-4xl">Gerencie sua consultoria sem sair do celular</h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400">Veja quem treinou hoje, quem está sumindo e quem está com mensalidade em atraso. Ajuste uma ficha e o aluno já recebe.</p>
              <button type="button" onClick={() => navigate('/register')} className="pressable mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-gray-900 px-6 text-sm font-black text-white dark:bg-white dark:text-black">
                Quero ser treinador <ArrowRight className="h-4 w-4" />
              </button>
            </Reveal>
            <Reveal delay={120}>
              <ul className="surface divide-y divide-gray-100 p-2 dark:divide-white/10">
                {COACH_POINTS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-4 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    <span className="text-sm font-semibold sm:text-base">{text}</span>
                    <Check className="ml-auto h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="px-4 pb-20">
          <Reveal>
            <div className="aurora-bg mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand to-[#FF9800] p-8 text-center text-black shadow-2xl shadow-brand/20 sm:p-12">
              <Dumbbell className="mx-auto h-10 w-10" aria-hidden="true" />
              <h2 className="mt-3 font-display text-3xl font-black sm:text-4xl">Seu próximo treino começa agora</h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium opacity-80 sm:text-base">Crie sua conta gratuita e monte sua primeira ficha em minutos.</p>
              <button type="button" onClick={goPrimary} className="pressable mt-6 inline-flex min-h-[56px] items-center gap-2 rounded-2xl bg-black px-8 text-base font-black text-brand shadow-xl">
                {user ? 'Abrir meu painel' : 'Começar agora'} <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-gray-200/70 py-8 text-center text-xs text-gray-600 dark:border-white/10 dark:text-gray-300">
        <p className="flex items-center justify-center gap-1.5"><Smartphone className="h-4 w-4" aria-hidden="true" /> Instale na tela inicial do celular para a melhor experiência.</p>
        <nav aria-label="Documentos legais" className="mt-2 flex justify-center gap-4 font-bold">
          <Link to="/privacidade" className="inline-flex min-h-[44px] items-center underline hover:text-brand">Privacidade</Link>
          <Link to="/termos" className="inline-flex min-h-[44px] items-center underline hover:text-brand">Termos de Uso</Link>
        </nav>
        <p className="mt-1">© {new Date().getFullYear()} BohTreinar · Treine · Evolua · Supere</p>
      </footer>
    </div>
  );
}
