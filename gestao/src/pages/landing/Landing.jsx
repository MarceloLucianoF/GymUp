import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBRL } from '../../lib/money';
import { CAPS, DEMO, FAQ, ROLES, SHOTS, SOON, STEPS } from './data';
import './landing.css';

// Entrada de cada parte da seção (título, texto, imagem), uma vez; nada fica escondido se o script falhar.
function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('lp-ready');
    const nodes = [...document.querySelectorAll('[data-reveal]')];
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { nodes.forEach((n) => n.classList.add('in')); return () => root.classList.remove('lp-ready'); }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    nodes.forEach((n) => io.observe(n));
    return () => { io.disconnect(); root.classList.remove('lp-ready'); };
  }, []);
}

// A coisa viva do herói: o quadro de mensalidades do mês. Dar baixa muda os totais na hora, como no produto.
function Board() {
  const [paid, setPaid] = useState([]);
  const sum = (list) => list.reduce((t, c) => t + c.cents, 0);
  const received = sum(DEMO.filter((c) => paid.includes(c.id)));
  const late = sum(DEMO.filter((c) => c.late && !paid.includes(c.id)));
  const open = sum(DEMO.filter((c) => !c.late && !paid.includes(c.id)));
  return (
    <div className="board" data-ui>
      <p className="board-title">Mensalidades de outubro <span>exemplo</span></p>
      <dl className="totals" aria-live="polite">
        <div><dt>Recebido</dt><dd>{formatBRL(received)}</dd></div>
        <div><dt>A receber</dt><dd>{formatBRL(open)}</dd></div>
        <div className="bad"><dt>Em atraso</dt><dd>{formatBRL(late)}</dd></div>
      </dl>
      <ul className="brows">
        {DEMO.map((c) => {
          const done = paid.includes(c.id);
          return (
            <li key={c.id} className={done ? 'done' : c.late ? 'late' : ''}>
              <span className="who"><b>{c.name}</b> <span>{c.plan} · vence dia {c.due}</span></span>
              <span className="amt">{formatBRL(c.cents)}</span>
              {done
                ? <span className="stamp">Pago</span>
                : <button type="button" onClick={() => setPaid((p) => [...p, c.id])}>Dar baixa<span className="visually-hidden"> de {c.name}</span></button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Landing() {
  useReveal();
  useEffect(() => { document.body.classList.add('lp-body'); document.title = 'BohTreinar Gestão: mensalidades, alunos e professores da sua academia'; return () => document.body.classList.remove('lp-body'); }, []);
  return (
    <div className="lp">
      <header className="hero">
        <nav className="lpbar" aria-label="Principal">
          <p className="logo">BohTreinar Gestão</p>
          <ul>
            <li><a href="#mensalidades">Mensalidades</a></li>
            <li><a href="#como">Como funciona</a></li>
            <li><a href="#perguntas">Perguntas</a></li>
          </ul>
          <Link className="lpbar-cta" to="/login">Entrar</Link>
        </nav>
        <h1 className="h1"><span className="mask"><span className="line">Mensalidade</span></span><span className="mask"><span className="line l2">em dia.</span></span></h1>
        <div className="hero-foot">
          <p className="lead">Alunos, professores e cobranças da sua academia em um só painel, sem planilha e sem caderno.</p>
          <Link className="btn-lp" to="/login?modo=cadastro">Criar academia</Link>
          <p className="note">Em testes fechados: ainda sem preço público.</p>
        </div>
        <div className="hero-board"><Board /></div>
      </header>

      <main id="principal">
        <section className="caps" aria-labelledby="caps-title" id="mensalidades">
          <h2 id="caps-title" className="caps-title">Tudo da academia em um lugar</h2>
          <ul className="caps-list">
            {CAPS.map(([name, text]) => (
              <li key={name} data-reveal><h3>{name}</h3><p>{text}</p></li>
            ))}
          </ul>
        </section>

        <section className="how" aria-labelledby="how-title" id="como">
          <h2 id="how-title" className="visually-hidden">Como funciona</h2>
          <ol className="stairs">
            {STEPS.map(([line, text]) => (
              <li key={line} data-reveal><h3>{line}</h3><p>{text}</p></li>
            ))}
          </ol>
        </section>

        <section className="roles" aria-labelledby="roles-title">
          <h2 id="roles-title" className="visually-hidden">Quem faz o quê</h2>
          {ROLES.map(([t, p], i) => (
            <div key={t} className={`stmt p${i}`} data-reveal><h3>{t}</h3><p>{p}</p></div>
          ))}
        </section>

        <section className="shots" aria-labelledby="shots-title">
          <h2 id="shots-title" className="shots-title">O dia a dia, na tela</h2>
          <div className="shot-grid">
            {SHOTS.map((s, i) => (
              <figure key={s.title} className={`shot sh${i}`} data-reveal>
                <div className="pic"><img src={s.img} width={s.w} height={s.h} alt={s.alt} loading="lazy" decoding="async" /></div>
                <figcaption><b>{s.title}</b> {s.text}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="next" aria-labelledby="next-title">
          <h2 id="next-title" data-reveal>Vem aí</h2>
          <ul>{SOON.map((s) => <li key={s} data-reveal>{s}</li>)}</ul>
        </section>

        <section className="faq" aria-labelledby="q-title" id="perguntas">
          <h2 id="q-title">Perguntas</h2>
          <div className="qa">
            {FAQ.map(([q, a]) => (
              <details key={q} name="faq"><summary>{q}<span className="plus" aria-hidden="true" /></summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <Link className="cta" to="/login?modo=cadastro" aria-label="Criar academia: cadastre os planos, convide a equipe e matricule o primeiro aluno">
          <span className="cta-note">Crie a academia, convide a equipe e cadastre o primeiro plano.</span>
          <svg className="cta-arrow" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><path d="M14 34 34 14M18 14h16v16" fill="none" stroke="currentColor" strokeWidth="4" /></svg>
          <span className="cta-word" aria-hidden="true">Criar</span>
        </Link>
      </main>

      <footer className="foot">
        <div className="foot-top">
          <p>Gestão de academias para o app BohTreinar.</p>
          <p>Versão de testes fechados.</p>
          <nav aria-label="Rodapé"><Link to="/termos">Termos</Link><Link to="/privacidade">Privacidade</Link><Link to="/login">Entrar</Link></nav>
        </div>
        <p className="foot-name">BohTreinar Gestão</p>
      </footer>
    </div>
  );
}
