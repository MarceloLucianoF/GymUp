import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePageMeta, { SITE_URL } from '../../hooks/usePageMeta';
import { useAuthContext } from '../../hooks/AuthContext';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import { CONTACT_EMAIL } from './LegalLayout';
import './landing.css';

// Telas reais do app (conta fictícia, dados de exemplo), recortadas como fotografias.
const REEL = [
  { src: '/landing/descanso.webp', video: '/landing/descanso.webm', pos: '50% 48%', cap: 'Descanso automático entre as séries', alt: 'Tela do descanso: anel amarelo com a contagem 1:28 e botões de ajustar o tempo' },
  { src: '/landing/treino.webp', pos: '50% 22%', cap: 'Carga e repetições com um toque', alt: 'Tela do treino em andamento: Supino Máquina, meta de 3 séries de 10 e botões de carga' },
  { src: '/landing/coach-ia.webp', pos: '50% 62%', cap: 'O Coach de IA monta a ficha que você pede', alt: 'Conversa com o Coach de IA: ficha de pernas só com máquinas' },
  { src: '/landing/fichas.webp', pos: '50% 38%', cap: 'Fichas prontas para começar hoje', alt: 'Biblioteca de fichas de treino do app' }
];

const SWITCHES = [
  { say: 'O descanso entre séries conta sozinho.', then: 'Registrou a série, o cronômetro de descanso já está rodando.' },
  { say: 'Sem sinal, o treino continua salvo.', then: 'Tudo sincroniza sozinho quando a rede volta.' },
  { say: 'A IA monta a ficha que você pede.', then: 'Só máquinas, o grupo que quiser, em segundos.' },
  { say: 'Cada carga vira gráfico de evolução.', then: 'Carga, volume e medidas ao longo das semanas.' },
  { say: 'Seu treinador ajusta e você recebe.', then: 'Chat e fichas atualizadas dentro do próprio app.' }
];

const STAGES = [
  { clause: 'Primeiro, crie a conta.', name: 'Conta', src: '/landing/cadastro.webp', alt: 'Tela de cadastro do app' },
  { clause: 'Depois, escolha a ficha.', name: 'Ficha', src: '/landing/fichas.webp', alt: 'Biblioteca de fichas de treino' },
  { clause: 'Então, treine e descanse.', name: 'Treino', src: '/landing/treino.webp', alt: 'Treino em andamento com carga e repetições' },
  { clause: 'Por fim, veja a semana.', name: 'Evolução', src: '/landing/inicio.webp', alt: 'Início do app com a meta semanal' }
];

const QUESTIONS = [
  ['Preciso pagar para usar?', 'Criar a conta é grátis e você já começa a treinar. As fichas prontas, o cronômetro e o registro de cargas estão liberados desde o primeiro dia.'],
  ['Funciona sem internet?', 'Sim. O treino é salvo no aparelho e sincroniza quando a rede volta. Abra o site no celular e adicione à tela inicial para usar como aplicativo.'],
  ['Preciso ter um treinador?', 'Não. Você pode usar as fichas prontas, pedir uma ficha ao Coach de IA ou receber a do seu treinador, que ajusta e você recebe no app.'],
  ['E os meus dados?', 'Você pode baixar uma cópia ou excluir a conta quando quiser, pelo seu Perfil. Os detalhes estão na Política de Privacidade.'],
  ['O Coach de IA substitui meu treinador?', 'Não. Ele sugere fichas e macros a partir do seu perfil e do seu histórico. Revise com um profissional, principalmente se você tem lesão ou condição de saúde.'],
  ['Sou treinador. Posso usar com meus alunos?', 'O app tem painel do treinador: carteira de alunos, editor de fichas, chat com cada aluno e financeiro com mensalidades. Para ativar o acesso, escreva para o contato no fim desta página.']
];

const EXAMPLES = ['Pernas só com máquinas', 'Full body somente máquinas', 'Treino de peito', 'Posterior e glúteos'];

const JSON_LD = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'BohTreinar', applicationCategory: 'HealthApplication',
  operatingSystem: 'Web, Android, iOS (PWA)', url: SITE_URL,
  description: 'App de treinos com fichas, cronômetro de descanso, evolução, chat com o treinador e Coach de IA.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' }
};

// A ficha da demonstração é gerada no aparelho, com a mesma montagem local do app (nada é enviado).
function useFicha(text) {
  const [state, setState] = useState({ status: 'idle' });
  useEffect(() => {
    const request = text.trim();
    if (!request) { setState({ status: 'idle' }); return undefined; }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const [{ aiService }, composer] = await Promise.all([import('../../services/aiService'), import('../../utils/workoutComposer')]);
        const workout = aiService.generateLocalWorkout({ userRequest: request, muscleFocus: 'Full Body (Corpo Todo)', goal: 'Hipertrofia' });
        const limit = composer.parseEquipmentConstraint(request);
        if (live) setState({ status: 'ready', workout, limit: limit ? composer.describeConstraint(limit) : '' });
      } catch (error) {
        if (live) setState({ status: 'error', message: error?.name === 'InsufficientExercisesError' ? error.message : 'Não consegui montar essa ficha. Tente outro pedido.' });
      }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [text]);
  return state;
}

export default function LandingPage() {
  usePageMeta('Treine. Evolua. Supere.', 'BohTreinar: fichas, cronômetro de descanso, evolução, chat com o treinador e Coach de IA. Funciona offline e é grátis para começar.');
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [activeSession, setActiveSession] = useState(null);
  const [js, setJs] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [away, setAway] = useState(false);
  const [frame, setFrame] = useState(0);
  const [ask, setAsk] = useState(EXAMPLES[0]);
  const [on, setOn] = useState([true, false, true, false, false]);
  const [stage, setStage] = useState(0);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const lastY = useRef(0);
  const heroRef = useRef(null);
  const stageRef = useRef(null);
  const ficha = useFicha(ask);

  useEffect(() => { setJs(true); }, []);
  useEffect(() => {
    if (!user?.uid) { setActiveSession(null); return; }
    try { setActiveSession(activeWorkoutService.getActiveSession(user.uid)); } catch { setActiveSession(null); }
  }, [user]);

  // O carretel da abertura avança com a rolagem enquanto a frase fica parada (a página rola normalmente; nada é sequestrado).
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const hero = heroRef.current; const st = stageRef.current;
      if (!hero || !st) return;
      const range = hero.offsetHeight - window.innerHeight;
      const progress = reduce || range <= 0 ? 0 : Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / range));
      const position = Math.min(REEL.length - 1, (progress / 0.82) * (REEL.length - 1));   // a última tela fica parada nos 18% finais
      st.style.setProperty('--reel', position.toFixed(3));
      setFrame((f) => (f === Math.round(position) ? f : Math.round(position)));
      const y = window.scrollY;
      setSticky(y > 700 && y + window.innerHeight < document.documentElement.scrollHeight - 700);
      setAway((was) => { const down = y > lastY.current; lastY.current = y; return y > 120 ? down : false; });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [js]);

  // Entrada das partes de cada seção, uma vez, na ordem de leitura.
  useEffect(() => {
    const nodes = [...document.querySelectorAll('.lp [data-in]')];
    if (!('IntersectionObserver' in window)) { nodes.forEach((n) => n.classList.add('in')); return undefined; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [js]);

  const goPrimary = useCallback(() => navigate(user ? '/dashboard' : '/register'), [navigate, user]);
  const continueWorkout = () => navigate(`/execution/${activeSession.trainingId}`);
  const primaryLabel = activeSession ? 'Continuar treino ativo' : user ? 'Ir para o meu painel' : 'Criar conta grátis';
  const primary = activeSession ? continueWorkout : goPrimary;
  const toggle = (i) => setOn((list) => list.map((v, k) => (k === i ? !v : v)));

  return (
    <div className={`lp ${js ? 'js' : ''}`}>
      <a className="skip" href="#main-content">Pular para o conteúdo</a>
      <header className={`bar ${away ? 'away' : ''}`}>
        <button type="button" className="brand" onClick={() => window.scrollTo({ top: 0 })} aria-label="BohTreinar, voltar ao topo">BOH<span>TREINAR</span></button>
        <nav aria-label="Principal">
          <a className="opt" href="#ficha">Ficha com IA</a>
          <a className="opt" href="#recursos">Recursos</a>
          <a className="opt" href="#duvidas">Dúvidas</a>
          {!user && <Link to="/login">Entrar</Link>}
          <button type="button" className="btn small" onClick={primary}>{user ? (activeSession ? 'Continuar treino' : 'Meu painel') : 'Criar conta'}</button>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

        <section ref={heroRef} className={`hero ${js ? 'pinned' : ''}`} aria-label="Apresentação">
          <div className="stage" ref={stageRef}>
            <h1 className="sentence"><span className="half l display">Seu treino</span><span className="half r display">cabe numa mão.</span></h1>
            <div className="frame" role="group" aria-roledescription="carrossel" aria-label="Telas do app">
              <div className="reelwrap">
                <div className="reel">
                  {REEL.map((s, i) => (
                    <figure key={s.src} className={`shot ${i === frame ? 'now' : ''}`} aria-hidden={i !== frame}>
                      {s.video && !reduceMotion
                        ? <video src={s.video} poster={s.src} muted loop autoPlay playsInline preload="metadata" aria-label={s.alt} style={{ objectPosition: s.pos }} width="390" height="844" />
                        : <img src={s.src} alt={i === frame ? s.alt : ''} style={{ objectPosition: s.pos }} width="780" height="1688" decoding="async" fetchpriority={i === 0 ? 'high' : undefined} loading={i === 0 ? 'eager' : 'lazy'} />}
                    </figure>
                  ))}
                </div>
              </div>
            </div>
            <div className="right"><p className="cap" aria-live="polite">{REEL[frame].cap}</p></div>
            <div className="hero-copy">
              <p>Fichas, cronômetro de descanso, evolução e Coach de IA. Funciona até sem sinal na academia.</p>
            </div>
            <div className="hero-action"><button type="button" className="btn" onClick={primary}>{primaryLabel}</button></div>
          </div>
        </section>

        <section id="ficha" className="field section-pad ask" aria-labelledby="ask-title">
          <h2 className="sr-only">Peça uma ficha ao Coach de IA</h2>
          <p id="ask-title" className="ask-label" data-in style={{ '--i': 0 }}>Peça uma ficha como você pediria ao Coach de IA. A resposta aparece aqui, no seu aparelho.</p>
          <input className="ask-line" data-in style={{ '--i': 1 }} type="text" value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={80} spellCheck="false" autoComplete="off" aria-label="Seu pedido de ficha" aria-describedby="ask-answer" />
          <div id="ask-answer" className="answer" aria-live="polite" data-in style={{ '--i': 2 }}>
            {ficha.status === 'ready' && (
              <>
                <p className="answer-head">{ficha.workout.name}{ficha.limit ? `, ${ficha.limit}` : ''}</p>
                <ul>
                  {ficha.workout.exercises.map((e, i) => <li key={e.name} style={{ '--i': i }}>{e.name}<span>{e.sets}x{e.reps} · {e.rest}s</span></li>)}
                </ul>
                <p className="note">Montada com a biblioteca de exercícios do app. No app você salva, ajusta e treina com o cronômetro.</p>
              </>
            )}
            {ficha.status === 'error' && <p className="err">{ficha.message}</p>}
            {ficha.status === 'idle' && <p className="muted">Escreva um grupo muscular, como pernas, peito ou full body.</p>}
            <div><button type="button" className="btn" onClick={goPrimary}>{user ? 'Abrir meu painel' : 'Salvar essa ficha no app'}</button></div>
          </div>
          <div className="examples" role="group" aria-label="Exemplos de pedido">
            {EXAMPLES.map((ex, i) => <button key={ex} type="button" data-in style={{ '--i': i }} onClick={() => setAsk(ex)}>{ex}</button>)}
          </div>
          <noscript><p>Ative o JavaScript para pedir uma ficha aqui. No app, o Coach de IA faz isso por você.</p></noscript>
        </section>

        <section className="steps" aria-labelledby="steps-title">
          <h2 id="steps-title" className="sr-only">Como começar</h2>
          <div className="steps-left">
            <div className="rail" data-in>
              <ol aria-hidden="true">{STAGES.map((s, i) => <li key={s.name} className={i === stage ? 'now' : ''}>{s.name}</li>)}</ol>
              <div className="track">
                <span className="base" /><span className="fill" style={{ '--p': `${(stage / (STAGES.length - 1)) * 100}%` }} />
                <input type="range" min="0" max={STAGES.length - 1} step="1" value={stage} onChange={(e) => setStage(Number(e.target.value))} aria-label="Etapa" aria-valuetext={STAGES[stage].clause} />
              </div>
            </div>
            <p className="clause" aria-live="polite" data-in>{STAGES[stage].clause}</p>
          </div>
          <div className="steps-right">
            <div className="step-shots">
              {STAGES.map((s, i) => <img key={s.src} src={s.src} alt={i === stage ? s.alt : ''} className={i === stage ? 'on' : ''} width="780" height="1688" loading="lazy" decoding="async" />)}
            </div>
          </div>
        </section>

        <section id="recursos" className="bands" aria-labelledby="bands-title">
          <h2 id="bands-title" className="sr-only">O que o app faz</h2>
          {SWITCHES.map((s, i) => (
            <div key={s.say} className={`band c${i} ${on[i] ? 'on' : ''}`} data-in style={{ '--i': i % 2 }}>
              <h3>{s.say}</h3>
              <button type="button" role="switch" aria-checked={on[i]} aria-label={s.say} className="switch" onClick={() => toggle(i)} />
              <p aria-hidden={!on[i]}>{s.then}</p>
            </div>
          ))}
        </section>

        <section id="duvidas" className="field section-pad faq" aria-labelledby="faq-title">
          <h2 id="faq-title" data-in>Dúvidas antes de começar</h2>
          <div className="qs">
            {QUESTIONS.map(([q, a], i) => (
              <details key={q} data-in style={{ '--i': i % 3 }}>
                <summary>{q}</summary>
                <p>{a} {q === 'E os meus dados?' && <Link to="/privacidade">Política de Privacidade</Link>}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="close" aria-labelledby="close-title">
          <h2 id="close-title" className="display" data-in><span>A próxima</span> <span>série é sua.</span></h2>
          <div className="close-row" data-in style={{ '--i': 1 }}>
            <p>Crie a conta grátis e comece com uma ficha pronta ou pedida ao Coach de IA.</p>
            <button type="button" className="btn" onClick={primary}>{primaryLabel}</button>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="foot-top" data-in>
          <div className="notes"><span>BohTreinar</span><span>Treine. Evolua. Supere.</span><span>Telas do app com dados de exemplo.</span></div>
          <button type="button" className="link top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Voltar ao topo</button>
        </div>
        <span />
        <a className="mail" data-in href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL.split('@')[0]}<wbr />@{CONTACT_EMAIL.split('@')[1]}</a>
        <div className="foot-meta" data-in style={{ '--i': 1 }}>
          <nav aria-label="Documentos legais"><Link to="/privacidade">Privacidade</Link><Link to="/termos">Termos de Uso</Link></nav>
          <span className="mid">Instale na tela inicial do celular</span>
          <span className="end">© {new Date().getFullYear()}</span>
        </div>
      </footer>

      {sticky && !user && (
        <div className="sticky-cta"><Link className="btn" to="/register">Criar conta grátis</Link></div>
      )}
    </div>
  );
}
