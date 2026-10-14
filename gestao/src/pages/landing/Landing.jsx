import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACCESS, AREAS, FACTS, FAQ, ROLE_NAMES, ROLE_ORDER, STAGES } from './data';
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

const MARK = { yes: 'Pode', part: 'Em parte', no: 'Não' };

// O controle do herói: o papel escolhido muda, na hora, o que a pessoa alcança. Os dados vêm da política real do produto.
function RoleControl() {
  const [role, setRole] = useState('coach');
  const name = useId();
  const rows = ACCESS[role];
  const open = rows.filter(([s]) => s !== 'no').length;
  return (
    <div className="ui roles" data-ui>
      <fieldset>
        <legend>Quem é a pessoa na academia?</legend>
        <div className="seg">
          {ROLE_ORDER.map((r) => (
            <label key={r} className={role === r ? 'on' : ''}>
              <input type="radio" name={name} value={r} checked={role === r} onChange={() => setRole(r)} />
              <span>{ROLE_NAMES[r]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <ul className="access" aria-live="polite">
        {AREAS.map((area, i) => (
          <li key={area} className={`s-${rows[i][0]}`}>
            <span className="area">{area}</span>
            <span className="state"><b>{MARK[rows[i][0]]}</b> {rows[i][1]}</span>
          </li>
        ))}
      </ul>
      <p className="readout">{ROLE_NAMES[role]}: {open} de {AREAS.length} áreas liberadas</p>
    </div>
  );
}

// Trechos de interface por etapa: o que a pessoa realmente vê em cada passo.
function StageFragment({ stage }) {
  if (stage === 0) return (
    <div className="ui frag" data-ui>
      <p className="frag-title">Novo convite</p>
      <div className="frag-row"><span>Papel</span><b>Professor</b></div>
      <div className="frag-row"><span>Usos</span><b>1</b></div>
      <div className="frag-row"><span>Validade</span><b>7 dias</b></div>
      <p className="frag-note">Copie agora: o link não será mostrado de novo.</p>
      <p className="frag-code">bohtreinar.app/convite/x7k2m9q4…</p>
    </div>
  );
  if (stage === 1) return (
    <div className="ui frag" data-ui>
      <p className="frag-title">Convite para Academia Exemplo</p>
      <p>Você entrará como <b>Professor</b>. A equipe verá seu nome e seu papel.</p>
      <p className="frag-note">Nada é gravado até você confirmar.</p>
      <div className="frag-actions"><span className="fake-btn primary">Aceitar convite</span><span className="fake-btn">Agora não</span></div>
    </div>
  );
  if (stage === 2) return (
    <div className="ui frag" data-ui>
      <p className="frag-title">No app do aluno</p>
      <p><b>Beatriz Nunes</b> quer acompanhar você na Academia Exemplo.</p>
      <p className="frag-note">Ela só vê seu nome e a data do vínculo.</p>
      <div className="frag-actions"><span className="fake-btn primary">Aceitar professor</span><span className="fake-btn">Recusar</span></div>
    </div>
  );
  return (
    <div className="ui frag" data-ui>
      <p className="frag-title">Perna A · versão 1</p>
      <ul className="frag-list"><li>Agachamento <span>3 x 10</span></li><li>Leg press <span>4 x 8-12</span></li><li>Mesa flexora <span>3 x 12</span></li></ul>
      <p className="frag-note">Versão publicada: não muda depois que o aluno a recebe.</p>
    </div>
  );
}

function HowItWorks() {
  const [i, setI] = useState(0);
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="how-left">
        <h2 id="how-title" className="clause" aria-live="polite" key={i}>{STAGES[i].clause}</h2>
      </div>
      <div className="how-right"><div className="frag-wrap" key={i}><StageFragment stage={i} /></div></div>
      <div className="slider">
        <label htmlFor="stage" className="visually-hidden">Etapa do fluxo</label>
        <div className="range">
          <span className="fill" style={{ width: `${(i / (STAGES.length - 1)) * 100}%` }} aria-hidden="true" />
          <input id="stage" type="range" min="0" max={STAGES.length - 1} step="1" value={i} onChange={(e) => setI(Number(e.target.value))} aria-valuetext={STAGES[i].name} />
        </div>
        <ol className="stops">{STAGES.map((s, n) => <li key={s.name}><button type="button" className={n === i ? 'on' : ''} onClick={() => setI(n)} aria-current={n === i ? 'step' : undefined}>{s.name}</button></li>)}</ol>
      </div>
    </section>
  );
}

function Module({ img, w, h, alt, title, children, crop }) {
  return (
    <div className="mod" data-reveal>
      <div className={`thumb ${crop || ''}`}><img src={img} width={w} height={h} alt={alt} loading="lazy" decoding="async" /></div>
      <div className="mod-text"><h3>{title}</h3>{children}</div>
    </div>
  );
}

export default function Landing() {
  useReveal();
  useEffect(() => { document.body.classList.add('lp-body'); document.title = 'BohTreinar Gestão: a gestão da sua academia em um só lugar'; return () => document.body.classList.remove('lp-body'); }, []);
  const faqRef = useRef(null);
  return (
    <div className="lp">
      <a className="skip" href="#principal">Pular para o conteúdo</a>
      <header className="hero">
        <div className="hero-ctrl"><RoleControl /></div>
        <div className="hero-copy">
          <p className="logo">BohTreinar <span>Gestão</span></p>
          <div className="hero-bottom">
            <h1 className="h1"><span className="mask"><span className="line">A gestão da sua academia</span></span><span className="mask"><span className="line l2">em um só lugar.</span></span></h1>
            <p className="lead">Membros, professores, convites e auditoria, cada pessoa vendo só o que o papel permite.</p>
            <Link className="btn-lp" to="/login?modo=cadastro">Criar academia</Link>
          </div>
        </div>
        <Link className="top-link" to="/login">Entrar</Link>
      </header>

      <main id="principal">
        <section className="features" aria-labelledby="f-title">
          <h2 id="f-title" data-reveal>O que a Gestão faz hoje</h2>
          <Module img="/landing/membros.jpg" w={716} h={860} crop="h280" alt="Tabela de membros com papel, status e professor responsável" title="Cada pessoa no papel certo">
            <p>Proprietário, administrador, professor, recepção e aluno. Filtre por papel, status ou professor e mude papéis com confirmação.</p>
            <p>O administrador não cria nem promove outro administrador, e a academia nunca fica sem proprietário.</p>
          </Module>
          <Module img="/landing/convite-uma-vez.jpg" w={716} h={814} alt="Aviso de convite criado: o link não será mostrado de novo" title="O código do convite aparece uma vez">
            <p>Defina o papel, os usos e a validade. Depois de copiar, o link some: o servidor guarda só uma impressão digital dele.</p>
            <p>Convite revogado, vencido ou esgotado dá sempre a mesma mensagem, sem revelar o motivo.</p>
          </Module>
          <Module img="/landing/vinculos.jpg" w={716} h={494} alt="Vínculos aguardando aprovação e aceite do aluno" title="O aluno aceita o professor">
            <p>A equipe propõe, ou o professor pede e a equipe aprova. O professor só enxerga o aluno depois do aceite, e perde o acesso quando o vínculo acaba.</p>
            <p>Transferir de professor encerra o anterior na mesma operação.</p>
          </Module>
          <Module img="/landing/auditoria.jpg" w={716} h={860} crop="h260" alt="Registro de auditoria com quem fez, a ação e o alvo" title="Toda mudança deixa rastro">
            <p>Quem fez, quando e o quê, em português. O registro não pode ser editado nem apagado, nem por quem administra.</p>
            <p>Só mudanças são registradas, com nomes públicos e nunca dados de saúde.</p>
          </Module>
          <Module img="/landing/professor-celular.jpg" w={780} h={1688} crop="h300 drift" alt="Tela do professor no celular com a lista dos seus alunos" title="O professor vê só os seus alunos, no celular">
            <p>A visão do professor é pensada para o celular: os alunos que aceitaram o vínculo e as propostas dele, nada além disso.</p>
          </Module>
          <Module img="/landing/resumo.jpg" w={716} h={600} crop="h220" alt="Indicadores da academia: membros, convites, professores e alunos sem professor" title="O painel conta pessoas, não treinos">
            <p>Membros ativos, convites pendentes, professores e alunos sem professor. Nenhuma tela mostra peso, medidas, cargas ou frequência individual.</p>
          </Module>
          <div className="mod soon-mod" data-reveal>
            <div className="mod-text solo"><h3>Fichas versionadas pela Gestão: em breve</h3><p>Hoje a ficha publicada já chega ao app do aluno com a versão exata e nunca muda depois de entregue. O editor de fichas na Gestão vem em uma próxima versão.</p></div>
          </div>
        </section>

        <HowItWorks />

        <section className="proof" aria-labelledby="p-title">
          <ul className="tiles">
            <li className="tile accent"><h2 id="p-title">Regras que valem sempre</h2></li>
            {FACTS.map(([n, t]) => <li key={t} className="tile" data-reveal><span className="n">{n}</span><span className="t">{t}</span></li>)}
          </ul>
        </section>

        <section className="faq" aria-labelledby="q-title" ref={faqRef}>
          <h2 id="q-title">Perguntas frequentes</h2>
          <div className="qa">
            {FAQ.map(([q, a]) => (
              <details key={q} name="faq"><summary>{q}<span className="plus" aria-hidden="true" /></summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="cta" aria-labelledby="c-title">
          <div className="side l" aria-hidden="true" />
          <div className="center-tile">
            <h2 id="c-title">Crie sua academia</h2>
            <p>Em minutos você cria a academia, convida a equipe e define quem vê o quê. Alunos continuam treinando no app BohTreinar.</p>
            <div className="cta-actions"><Link className="btn-lp dark" to="/login?modo=cadastro">Criar academia</Link><Link className="link-lp" to="/login">Já tenho conta</Link></div>
          </div>
          <div className="side r" aria-hidden="true" />
        </section>
      </main>

      <footer className="foot">
        <p>BohTreinar Gestão, gestão de academias</p>
        <nav aria-label="Rodapé"><Link to="/termos">Termos</Link><Link to="/privacidade">Privacidade</Link><Link to="/login">Entrar</Link><Link to="/login?modo=cadastro">Criar academia</Link></nav>
        <p className="r">2026 · Versão de homologação</p>
      </footer>
    </div>
  );
}
