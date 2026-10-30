import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { auth } from '../../firebase/config';
import { useConfirm } from '../../hooks/useConfirm';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../coach/styles';
import {
  MIN_PASSWORD, changeEmail, changePassword, connectGoogle, createPassword, disconnectGoogle, friendlySecurityError, loginMethods, passwordProblem, sendResetLink
} from '../../services/accountSecurity';

const rowCls = 'flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

/** Formulário de senha: trocar (quem tem senha) ou criar (quem só entra com Google). */
function PasswordForm({ mode, onDone, onCancel }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(next, again);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      if (mode === 'change') await changePassword(auth.currentUser, current, next);
      else await createPassword(auth.currentUser, next);
      onDone(mode === 'change' ? 'Senha alterada.' : 'Senha criada. Agora você também entra com e-mail e senha.');
    } catch (err) {
      setError(friendlySecurityError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5" noValidate>
      {mode === 'change' && (
        <div>
          <label htmlFor="pw-current" className={labelCls}>Senha atual</label>
          <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
        </div>
      )}
      <div>
        <label htmlFor="pw-new" className={labelCls}>Nova senha</label>
        <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} aria-describedby="pw-hint" />
        <p id="pw-hint" className="mt-1 text-xs text-gray-600 dark:text-gray-400">Pelo menos {MIN_PASSWORD} caracteres, com letras e números.</p>
      </div>
      <div>
        <label htmlFor="pw-again" className={labelCls}>Repita a nova senha</label>
        <input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputCls} />
      </div>
      {mode === 'create' && <p className="text-xs text-gray-600 dark:text-gray-400">Vamos pedir para confirmar com o Google antes de criar a senha.</p>}
      {error && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Salvando…' : mode === 'change' ? 'Trocar senha' : 'Criar senha'}</button>
        <button type="button" onClick={onCancel} disabled={busy} className={btnGhost}>Cancelar</button>
      </div>
    </form>
  );
}

/** Troca de e-mail: o link vai para o novo endereço e a troca só vale depois de aberto. */
function EmailForm({ user, hasPassword, onDone, onCancel }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { onDone(await changeEmail(auth.currentUser, email, { password })); }
    catch (err) { setError(friendlySecurityError(err)); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5" noValidate>
      <div>
        <label htmlFor="email-new" className={labelCls}>Novo e-mail</label>
        <input id="email-new" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </div>
      {hasPassword && (
        <div>
          <label htmlFor="email-pw" className={labelCls}>Senha atual</label>
          <input id="email-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </div>
      )}
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Vamos mandar um link para o novo e-mail. A troca só vale depois que você abrir o link; até lá, continue entrando com {user.email}.
        {!hasPassword && ' Antes, vamos pedir para confirmar com o Google.'}
      </p>
      {error && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Enviando…' : 'Enviar link'}</button>
        <button type="button" onClick={onCancel} disabled={busy} className={btnGhost}>Cancelar</button>
      </div>
    </form>
  );
}

// Conta e segurança: e-mail, formas de entrar (senha e Google) e redefinição por e-mail.
export default function AccountSecurity({ user }) {
  const { confirm, dialog } = useConfirm();
  const [methods, setMethods] = useState(() => loginMethods(user));
  const [form, setForm] = useState(null);   // 'change' | 'create' | null
  const [emailForm, setEmailForm] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => setMethods(loginMethods(auth.currentUser));

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); refresh(); toast.success(ok); }
    catch (err) { toast.error(friendlySecurityError(err)); }
    finally { setBusy(false); }
  };

  const linkGoogle = () => run(() => connectGoogle(auth.currentUser), 'Conta Google conectada. Agora você também entra com o Google.');
  const unlinkGoogle = async () => {
    const ok = await confirm({ title: 'Desconectar o Google?', message: 'Você passa a entrar só com e-mail e senha.', confirmLabel: 'Desconectar', danger: true });
    if (ok) await run(() => disconnectGoogle(auth.currentUser), 'Google desconectado.');
  };
  const resetByEmail = () => run(() => sendResetLink(auth, user.email), `Enviamos um link para ${user.email}.`);

  return (
    <div className="space-y-3">
      {dialog}
      <div className={rowCls}>
        <div className="flex min-w-0 items-center gap-3">
          <Mail className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white">E-mail</p>
            <p className="truncate text-sm text-gray-600 dark:text-gray-400">{user.email || 'Sem e-mail'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user.emailVerified && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Verificado</span>}
          {!emailForm && user.email && <button type="button" onClick={() => setEmailForm(true)} className={btnGhost}>Trocar e-mail</button>}
        </div>
      </div>
      {emailForm && <EmailForm user={user} hasPassword={methods.password} onCancel={() => setEmailForm(false)} onDone={(next) => { setEmailForm(false); setPendingEmail(next); toast.success('Pedido enviado. Confira a caixa de entrada do novo e-mail.'); }} />}
      {pendingEmail && (
        <p role="status" className="rounded-2xl bg-amber-500/15 p-3 text-sm text-amber-900 dark:text-amber-200">
          Se <b>{pendingEmail}</b> não for usado por outra conta, ele recebe um link. Abra o link para concluir a troca e depois entre de novo com o novo e-mail.
        </p>
      )}

      <div className={rowCls}>
        <div className="flex min-w-0 items-center gap-3">
          <KeyRound className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Senha</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{methods.password ? 'Você entra com e-mail e senha.' : 'Você ainda não tem senha (entra com o Google).'}</p>
          </div>
        </div>
        {!form && (
          <button type="button" onClick={() => setForm(methods.password ? 'change' : 'create')} disabled={busy} className={btnGhost}>
            {methods.password ? 'Trocar senha' : 'Criar senha'}
          </button>
        )}
      </div>
      {form && <PasswordForm mode={form} onCancel={() => setForm(null)} onDone={(msg) => { setForm(null); refresh(); toast.success(msg); }} />}
      {methods.password && !form && user.email && (
        <p className="px-1 text-xs text-gray-600 dark:text-gray-400">
          Esqueceu a senha atual? <button type="button" onClick={resetByEmail} disabled={busy} className="min-h-[44px] font-bold underline">Receber link de redefinição por e-mail</button>
        </p>
      )}

      <div className={rowCls}>
        <div className="flex min-w-0 items-center gap-3">
          <GoogleMark />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Google</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{methods.google ? 'Conectado: você pode entrar com o Google.' : 'Conecte para entrar com um toque.'}</p>
          </div>
        </div>
        {methods.google ? (
          methods.password && <button type="button" onClick={unlinkGoogle} disabled={busy} className={btnGhost}>Desconectar</button>
        ) : (
          <button type="button" onClick={linkGoogle} disabled={busy} className={btnGhost}>Conectar Google</button>
        )}
      </div>
    </div>
  );
}
