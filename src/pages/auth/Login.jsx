import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthField from './AuthField';
import { BrandWordmark } from '../../components/brand/Brand';
import GoogleButton, { OrDivider } from '../../components/auth/GoogleButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const emailRef = useRef(null);
  
  const { login, authLoading, user } = useAuthContext();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(false);

  // Redireciona se já logado
  useEffect(() => {
    if (user) navigate('/home');
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (localLoading) return; // evita duplo envio
    setFormError('');
    setLocalLoading(true);
    const toastId = toast.loading('Autenticando...');

    try {
      await login(email, password);
      toast.success('Bem-vindo de volta!', { id: toastId });
      // O useEffect redireciona
    } catch (err) {
      console.error(err);
      const message = err.message || "Erro ao entrar.";
      toast.error(message, { id: toastId });
      setFormError(message);
      setLocalLoading(false);
      emailRef.current?.focus();
    }
  };

  if (authLoading) return null; // Evita flash

  return (
    <div className="min-h-[100dvh] flex bg-white dark:bg-[#0B0F19] transition-colors">
      
      {/* Lado Esquerdo (Visual - Igual ao Registro) */}
      <div className="hidden lg:flex w-1/2 bg-gray-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 animate-fade-in bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
        
        <div className="relative z-10 p-12 text-white max-w-lg">
          <div className="text-5xl font-black mb-6 leading-tight tracking-tight">
            <BrandWordmark />
          </div>
          <p className="text-2xl font-light text-gray-200 mb-8 leading-relaxed">
            "A única repetição ruim é aquela que você não fez."
          </p>
          <div className="flex gap-2">
             <div className="h-1 w-12 bg-brand rounded-full"></div>
             <div className="h-1 w-4 bg-gray-600 rounded-full"></div>
             <div className="h-1 w-4 bg-gray-600 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Lado Direito (Formulário) */}
      <div className="aurora-bg w-full lg:w-1/2 flex items-center justify-center p-5 sm:p-8 bg-gray-50 dark:bg-[#0B0F19] overflow-hidden">
        <div className="surface w-full max-w-md space-y-6 p-6 sm:p-8 animate-fade-up">
          
          <div className="text-center lg:text-left">
            <div className="lg:hidden font-display text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tighter"><BrandWordmark /></div>
            <h1 className="font-display text-3xl font-black text-gray-900 dark:text-white">Bem-vindo de volta!</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Digite suas credenciais para acessar sua ficha.</p>
          </div>

          <GoogleButton />
          <OrDivider />

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              
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
                error={formError}
              />

              <AuthField
                label="Senha"
                passwordToggle
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                labelAside={(
                  <Link to="/forgot-password" className="text-xs font-bold text-amber-700 dark:text-brand hover:text-brand-dark transition-colors min-h-[44px] inline-flex items-center">
                    Esqueceu a senha?
                  </Link>
                )}
              />
            </div>

            <button
              type="submit"
              disabled={localLoading}
              aria-busy={localLoading}
              className="w-full flex items-center justify-center min-h-[56px] px-4 rounded-2xl shadow-lg shadow-brand/25 text-base font-black text-black bg-gradient-to-r from-brand to-[#FF9800] hover:shadow-[0_0_24px_rgba(255,193,7,0.4)] transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {localLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                    Entrando...
                  </span>
              ) : 'Acessar conta'}
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Não tem uma conta?{' '}
              <Link to="/register" className="font-bold text-amber-700 dark:text-brand hover:text-brand-dark transition-colors">
                Criar conta grátis
              </Link>
            </p>
            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              <Link to="/termos" className="underline hover:text-brand">Termos de Uso</Link>
              {' · '}
              <Link to="/privacidade" className="underline hover:text-brand">Política de Privacidade</Link>
            </p>
            <p className="mt-3 text-[11px] leading-snug text-gray-600 dark:text-gray-400">
              Protegido pelo reCAPTCHA. Valem a <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">Política de Privacidade do Google</a> e os <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">Termos de Serviço do Google</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}