import React from 'react';
import { Link } from 'react-router-dom';

export default function Legal({ title, children }) {
  return (
    <main className="center" id="conteudo">
      <article className="panel legal">
        <Link to="/" className="brand small">BohTreinar <span>Gestão</span></Link>
        <h1>{title}</h1>
        <p className="muted"><strong>Versão preliminar de homologação.</strong> Este texto descreve o funcionamento atual do produto e ainda passa por revisão jurídica antes de qualquer uso comercial.</p>
        {children}
        <nav aria-label="Outras páginas" className="row-actions"><Link to="/" className="link">Início</Link><Link to="/login" className="link">Entrar</Link><Link to="/privacidade" className="link">Privacidade</Link><Link to="/termos" className="link">Termos</Link></nav>
      </article>
    </main>
  );
}
