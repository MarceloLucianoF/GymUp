import React, { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { profileReady, useSession } from '../session';
import { safeNext } from '../lib/policy';
import { Field } from '../components/ui';

// Mensagens genéricas: nunca dizem se o e-mail existe (sem enumeração de contas).
const GENERIC = { signin: 'E-mail ou senha incorretos.', signup: 'Não foi possível criar a conta. Confira os dados ou tente entrar.', reset: 'Se o e-mail estiver cadastrado, enviaremos as instruções para ele.' };

export default function Login() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const next = safeNext(params.get('next'));
  const mode = ['cadastro', 'recuperar'].includes(params.get('modo')) ? params.get('modo') : 'entrar';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [state, setState] = useState({ status: 'idle', message: '' });
  if (user) return <Navigate to={next} replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const go = (m) => { const p = new URLSearchParams(params); if (m === 'entrar') p.delete('modo'); else p.set('modo', m); setParams(p, { replace: true }); setState({ status: 'idle', message: '' }); };

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'loading', message: '' });
    try {
      if (mode === 'entrar') await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      else if (mode === 'cadastro') {
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        // A tela já pode seguir para o app: qualquer chamada à API espera o nome ser gravado e o token ser renovado.
        if (form.name.trim()) profileReady.promise = updateProfile(cred.user, { displayName: form.name.trim().slice(0, 80) }).then(() => cred.user.getIdToken(true)).catch(() => {});
      } else {
        await sendPasswordResetEmail(auth, form.email.trim()).catch(() => {});   // o resultado não muda a resposta
        setState({ status: 'done', message: GENERIC.reset });
        return;
      }
    } catch { setState({ status: 'error', message: GENERIC[mode === 'entrar' ? 'signin' : 'signup'] }); return; }
    setState({ status: 'idle', message: '' });
  };
  const google = async () => {
    setState({ status: 'loading', message: '' });
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch { setState({ status: 'error', message: 'Não foi possível entrar com o Google.' }); }
  };
  const busy = state.status === 'loading';
  const title = { entrar: 'Entrar na Gestão', cadastro: 'Criar conta', recuperar: 'Recuperar senha' }[mode];
  return (
    <main className="center" id="conteudo">
      <form className="panel auth" onSubmit={submit} noValidate={false} aria-labelledby="auth-title">
        <Link to="/" className="brand small">BohTreinar <span>Gestão</span></Link>
        <h1 id="auth-title">{title}</h1>
        {params.get('next')?.startsWith('/convite/') && <p className="muted">Entre ou crie sua conta para continuar com o convite.</p>}
        {mode === 'cadastro' && <Field id="name" label="Seu nome" hint="É como a equipe da academia vê você."><input id="name" autoComplete="name" value={form.name} onChange={set('name')} maxLength={80} required /></Field>}
        <Field id="email" label="E-mail"><input id="email" type="email" autoComplete="username" value={form.email} onChange={set('email')} required /></Field>
        {mode !== 'recuperar' && <Field id="password" label="Senha" hint={mode === 'cadastro' ? 'Mínimo de 8 caracteres.' : undefined}><input id="password" type="password" autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} minLength={mode === 'cadastro' ? 8 : undefined} required /></Field>}
        {state.status === 'error' && <p role="alert" className="error">{state.message}</p>}
        {state.status === 'done' && <p role="status" className="ok">{state.message}</p>}
        <button type="submit" className="btn primary block" disabled={busy}>{busy ? 'Aguarde...' : { entrar: 'Entrar', cadastro: 'Criar conta', recuperar: 'Enviar instruções' }[mode]}</button>
        {mode !== 'recuperar' && <button type="button" className="btn ghost block" onClick={google} disabled={busy}>Continuar com Google</button>}
        <div className="auth-links">
          {mode !== 'entrar' && <button type="button" className="link-btn" onClick={() => go('entrar')}>Já tenho conta</button>}
          {mode !== 'cadastro' && <button type="button" className="link-btn" onClick={() => go('cadastro')}>Criar conta</button>}
          {mode === 'entrar' && <button type="button" className="link-btn" onClick={() => go('recuperar')}>Esqueci a senha</button>}
        </div>
        {mode === 'cadastro' && <p className="muted small">Ao criar a conta você concorda com os <Link to="/termos">Termos</Link> e a <Link to="/privacidade">Política de privacidade</Link>.</p>}
      </form>
    </main>
  );
}
