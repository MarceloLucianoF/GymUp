import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../firebase/config';
import AuthField from './AuthField';
import { BrandWordmark } from '../../components/brand/Brand';
import usePageMeta from '../../hooks/usePageMeta';
import { validatePassword, PASSWORD_HINT } from '../../utils/password';

const ERRORS = {
  'auth/expired-action-code': 'Este link expirou. Peça um novo.',
  'auth/invalid-action-code': 'Este link é inválido ou já foi usado. Peça um novo.',
  'auth/user-disabled': 'Esta conta está desativada.',
  'auth/user-not-found': 'Conta não encontrada.',
  'auth/weak-password': 'Senha fraca: use ao menos 8 caracteres, com maiúscula, número e símbolo.',
  'auth/password-does-not-meet-requirements': 'Senha fraca: use ao menos 8 caracteres, com maiúscula, número e símbolo.',
  'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente de novo.'
};
export const actionError = (code) => ERRORS[code] || 'Não foi possível concluir. Tente de novo.';

const Shell = ({ title, children }) => (
  <div className="aurora-bg flex min-h-[100dvh] items-center justify-center bg-gray-50 p-5 dark:bg-[#0B0F19]">
    <div className="surface w-full max-w-md space-y-5 p-6 sm:p-8 animate-fade-up">
      <div className="text-center">
        <div className="mb-2 font-display text-4xl font-black tracking-tighter text-gray-900 dark:text-white"><BrandWordmark /></div>
        <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white">{title}</h1>
      </div>
      {children}
    </div>
  </div>
);

const LinkButton = ({ to, children }) => (
  <Link to={to} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand to-[#FF9800] px-4 text-sm font-black text-black shadow-lg shadow-brand/25">
    {children}
  </Link>
);

// Página de ação dos e-mails do Firebase (redefinir senha e confirmar e-mail), no visual do app.
// Configure em Authentication > Modelos > "Personalizar URL de ação": https://<site>/auth/action
export default function AuthAction() {
  usePageMeta('Conta', 'Redefinição de senha e confirmação de e-mail.', { noindex: true });
  const [params] = useSearchParams();
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');

  const [phase, setPhase] = useState('loading'); // loading | form | done | error
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!oobCode || !['resetPassword', 'verifyEmail', 'recoverEmail', 'verifyAndChangeEmail'].includes(mode)) {
        setError('Link incompleto ou inválido. Peça um novo.'); setPhase('error'); return;
      }
      try {
        if (mode === 'resetPassword') {
          const mail = await verifyPasswordResetCode(auth, oobCode);
          if (!cancelled) { setEmail(mail); setPhase('form'); }
        } else {
          await applyActionCode(auth, oobCode);
          if (!cancelled) setPhase('done');
        }
      } catch (err) {
        if (!cancelled) { setError(actionError(err.code)); setPhase('error'); }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [mode, oobCode]);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const problem = validatePassword(password) || (password !== confirm ? 'As senhas não conferem.' : '');
    if (problem) { setFieldError(problem); return; }
    setFieldError(''); setSaving(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setPhase('done');
    } catch (err) {
      setError(actionError(err.code)); setPhase(err.code?.includes('password') ? 'form' : 'error');
      if (err.code?.includes('password')) setFieldError(actionError(err.code));
    } finally {
      setSaving(false);
    }
  };

  if (phase === 'loading') {
    return <Shell title="Um instante..."><p role="status" className="text-center text-gray-600 dark:text-gray-400">Validando o link.</p></Shell>;
  }
  if (phase === 'error') {
    return (
      <Shell title="Link indisponível">
        <p role="alert" className="text-center text-gray-700 dark:text-gray-300">{error}</p>
        <LinkButton to="/forgot-password">Pedir novo link</LinkButton>
      </Shell>
    );
  }
  if (phase === 'done') {
    const text = mode === 'resetPassword' ? 'Senha alterada. Entre com a nova senha.' : mode === 'recoverEmail' ? 'E-mail restaurado.' : mode === 'verifyAndChangeEmail' ? 'E-mail alterado. Entre de novo usando o novo e-mail.' : 'E-mail confirmado.';
    return (
      <Shell title="Tudo certo">
        <p role="status" className="text-center text-gray-700 dark:text-gray-300">{text}</p>
        <LinkButton to="/login">Ir para o login</LinkButton>
      </Shell>
    );
  }
  return (
    <Shell title="Criar nova senha">
      <p className="text-center text-sm text-gray-600 dark:text-gray-400">Conta: <b className="text-gray-900 dark:text-white">{email}</b></p>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <AuthField label="Nova senha" passwordToggle required autoComplete="new-password" minLength={8}
          value={password} onChange={(e) => setPassword(e.target.value)} hint={PASSWORD_HINT} error={fieldError} />
        <AuthField label="Confirmar senha" passwordToggle required autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" disabled={saving} aria-busy={saving}
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand to-[#FF9800] px-4 text-sm font-black text-black shadow-lg shadow-brand/25 disabled:opacity-60">
          {saving ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </Shell>
  );
}
