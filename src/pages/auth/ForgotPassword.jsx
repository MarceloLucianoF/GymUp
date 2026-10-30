import React, { useState, useRef } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import AuthField from './AuthField';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const emailRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // evita duplo envio
    if (!email) {
      setError('Informe seu e-mail.');
      emailRef.current?.focus();
      return;
    }

    setError('');
    setSent(false);
    setLoading(true);
    try {
      // Depois de trocar a senha na página do Firebase, o botão "Continuar" leva de volta ao login do app.
      await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/login` });
      toast.success('Se o e-mail tiver conta, o link de recuperação foi enviado. Verifique sua caixa de entrada.');
      setEmail('');
      setSent(true);
    } catch (error) {
      // E-mail sem conta responde igual ao sucesso: não revela quais e-mails estão cadastrados.
      if (error.code === 'auth/user-not-found') {
        toast.success('Se o e-mail tiver conta, o link de recuperação foi enviado. Verifique sua caixa de entrada.');
        setEmail('');
        setSent(true);
        return;
      }
      console.error(error);
      let msg = "Erro ao enviar e-mail.";
      if (error.code === 'auth/invalid-email') msg = "E-mail inválido.";
      toast.error(msg);
      setError(msg);
      emailRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aurora-bg min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-[#0B0F19] p-4 overflow-hidden transition-colors">
      <div className="surface p-6 sm:p-8 w-full max-w-md animate-fade-up">
        <div className="text-center mb-6">
          <h2 className="font-display text-2xl font-black text-gray-900 dark:text-white">Recuperar senha</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Digite seu e-mail para receber o link.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <AuthField
            ref={emailRef}
            label="E-mail"
            type="email"
            inputMode="email"
            required
            autoFocus
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            error={error}
          />

          <p role="status" aria-live="polite" className={sent ? 'text-sm font-medium text-emerald-700 dark:text-emerald-400' : 'sr-only'}>
            {sent ? 'Se o e-mail tiver conta, enviamos o link de recuperação. Verifique sua caixa de entrada.' : ''}
          </p>

          <button 
            type="submit" 
            disabled={loading}
            aria-busy={loading}
            className="w-full bg-gradient-to-r from-brand to-[#FF9800] text-black font-black min-h-[56px] rounded-2xl shadow-lg shadow-brand/25 transition-transform active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-brand min-h-[44px] transition-colors flex items-center justify-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}