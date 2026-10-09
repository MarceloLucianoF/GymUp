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
      setError('Informe seu email.');
      emailRef.current?.focus();
      return;
    }

    setError('');
    setSent(false);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setEmail('');
      setSent(true);
    } catch (error) {
      console.error(error);
      let msg = "Erro ao enviar email.";
      if (error.code === 'auth/user-not-found') msg = "Email não cadastrado.";
      if (error.code === 'auth/invalid-email') msg = "Email inválido.";
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
          <h2 className="font-display text-2xl font-black text-gray-900 dark:text-white">Recuperar Senha</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Digite seu email para receber o link.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <AuthField
            ref={emailRef}
            label="Email"
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

          <p role="status" aria-live="polite" className={sent ? 'text-sm font-medium text-emerald-600 dark:text-emerald-400' : 'sr-only'}>
            {sent ? 'Email de recuperação enviado. Verifique sua caixa de entrada.' : ''}
          </p>

          <button 
            type="submit" 
            disabled={loading}
            aria-busy={loading}
            className="w-full bg-gradient-to-r from-brand to-[#FF9800] text-black font-black min-h-[56px] rounded-2xl shadow-lg shadow-brand/25 transition-transform active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
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