import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { resolveCoachCode } from '../../services/coachLinkService';
import { KeyRound, Check } from 'lucide-react';
import usePageMeta from '../../hooks/usePageMeta';
import AuthField from './AuthField';
import { BrandWordmark } from '../../components/brand/Brand';
import GoogleButton, { OrDivider } from '../../components/auth/GoogleButton';
import { validatePassword, PASSWORD_MIN_LENGTH, PASSWORD_HINT } from '../../utils/password';

export default function Register() {
  usePageMeta('Criar conta', 'Crie sua conta gratuita no BohTreinar.');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [accepted, setAccepted] = useState(false);
  const refs = {
    displayName: useRef(null),
    email: useRef(null),
    password: useRef(null),
    confirmPassword: useRef(null),
    coachCode: useRef(null),
    terms: useRef(null),
  };
  
  // Lógica do Convite
  const [coachCode, setCoachCode] = useState('');
  const [coachName, setCoachName] = useState(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [coachKind, setCoachKind] = useState('coach');
  const [coachResolved, setCoachResolved] = useState('');
  const [coachMessage, setCoachMessage] = useState('');
  const [searchParams] = useSearchParams();

  const { register, user, authLoading } = useAuthContext();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/home');
  }, [user, navigate]);

  useEffect(() => {
      const codeFromUrl = searchParams.get('coach');
      if (codeFromUrl) {
          setCoachCode(codeFromUrl);
          verifyCoach(codeFromUrl);
      }
  }, [searchParams]);

  // Confere o código ou o convite só com dados públicos (ainda não há login nesta tela).
  const verifyCoach = async (code) => {
      if (!code) return;
      setIsCheckingCode(true);
      setCoachMessage('');
      try {
          const found = await resolveCoachCode(code);
          if (found?.ok) {
              setCoachName(found.coachName || 'Treinador');
              setCoachKind(found.kind);
              setCoachResolved(found.code);
              toast.success(found.coachName ? `Treinador encontrado: ${found.coachName}` : 'Convite válido.');
          } else {
              setCoachName(null);
              setCoachMessage(found?.message || 'Código de treinador inválido.');
              toast.error(found?.message || 'Código de treinador inválido.');
          }
      } catch (err) {
          console.error(err);
          setCoachName(null);
          setCoachMessage('Não foi possível conferir o código agora. Tente de novo.');
      } finally {
          setIsCheckingCode(false);
      }
  };

  const handleBlurCoachCode = () => {
      if(coachCode && !coachName) verifyCoach(coachCode);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (localLoading) return; // evita duplo envio

    const nextErrors = {};
    if (!displayName.trim()) nextErrors.displayName = 'Informe seu nome.';
    if (!email.trim()) nextErrors.email = 'Informe seu email.';
    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    if (password !== confirmPassword) nextErrors.confirmPassword = 'As senhas não conferem!';

    let verifiedCoachId = null;
    let verifiedInviteId = null;
    if (coachCode.trim()) {
        if (!coachName) nextErrors.coachCode = coachMessage || 'Verifique o código do treinador antes de continuar.';
        else if (coachKind === 'invite') verifiedInviteId = coachResolved;
        else verifiedCoachId = coachResolved || coachCode.trim();
    }

    if (!accepted) nextErrors.terms = 'Aceite os Termos e a Política de Privacidade para continuar.';

    setErrors(nextErrors);
    const firstInvalid = ['displayName', 'email', 'password', 'confirmPassword', 'coachCode', 'terms'].find((k) => nextErrors[k]);
    if (firstInvalid) {
        refs[firstInvalid].current?.focus();
        return toast.error(nextErrors[firstInvalid]);
    }

    setLocalLoading(true);
    const loadingToast = toast.loading('Criando sua conta...');

    try {
      await register(email, password, displayName, { 
          coachId: verifiedCoachId,
          inviteId: verifiedInviteId,
          currentTrainingId: null,
          acceptedTerms: true
      });
      // O aceite também fica na conta (termsAcceptedAt/termsVersion); a cópia local serve de reserva.
      try { localStorage.setItem('bt_terms_accepted_at', new Date().toISOString()); } catch { /* sem storage */ }
      toast.success(`Bem-vindo!`, { id: loadingToast });
      navigate('/home');
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erro ao criar conta.", { id: loadingToast });
    } finally {
      setLocalLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-900 transition-colors">
      
      {/* Lado Esquerdo (Banner) */}
      <div className="hidden lg:flex w-1/2 bg-gray-900 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1470&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
        
        <div className="relative z-10 p-12 text-white max-w-lg">
          <h2 className="text-5xl font-black mb-6 leading-tight">Construa sua melhor versão.</h2>
          <ul className="space-y-4 text-lg text-gray-200">
            <li className="flex items-center gap-3">
              <div className="bg-green-500/20 p-1 rounded-full text-green-450 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div> 
              Acompanhe sua evolução
            </li>
            <li className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-1 rounded-full text-blue-450 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div> 
              Gráficos de performance
            </li>
            <li className="flex items-center gap-3">
              <div className="bg-purple-500/20 p-1 rounded-full text-purple-450 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div> 
              Contato direto com seu coach
            </li>
          </ul>
        </div>
      </div>

      {/* Lado Direito (Form) */}
      <div className="aurora-bg w-full lg:w-1/2 flex items-center justify-center p-5 sm:p-8 bg-gray-50 dark:bg-[#0B0F19] overflow-hidden">
        <div className="surface w-full max-w-md space-y-6 p-6 sm:p-8 animate-fade-up">
          
          <div className="text-center lg:text-left">
            <div className="lg:hidden font-display text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tighter"><BrandWordmark /></div>
            <h1 className="font-display text-3xl font-black text-gray-900 dark:text-white">Crie sua conta</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Comece hoje mesmo.</p>
          </div>

          <div className="mt-8 space-y-5">
            <GoogleButton label="Cadastrar com o Google" />
            <OrDivider />
          </div>

          <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
            <AuthField ref={refs.displayName} label="Nome Completo" type="text" required autoFocus autoComplete="name"
              value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex: João Silva" error={errors.displayName} />

            <AuthField ref={refs.email} label="Email" type="email" inputMode="email" required autoComplete="email"
              autoCapitalize="none" spellCheck={false}
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" error={errors.email} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AuthField ref={refs.password} label="Senha" passwordToggle required autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ex.: Treino#2026" hint={PASSWORD_HINT} error={errors.password} />
              <AuthField ref={refs.confirmPassword} label="Confirmar" passwordToggle required autoComplete="new-password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" error={errors.confirmPassword} />
            </div>

            {/* CAMPO DE CÓDIGO DO TREINADOR */}
            <div className="pt-2">
                <label htmlFor="register-coach-code" className="text-xs font-bold text-amber-700 dark:text-brand uppercase ml-1 flex justify-between cursor-pointer group">
                    <span>Código do Treinador (Opcional)</span>
                    <span className="text-xs font-semibold normal-case">Peça ao seu coach</span>
                </label>
                <div className="relative mt-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 flex items-center justify-center">
                        <KeyRound className="w-5 h-5" />
                    </div>
                    <input 
                        id="register-coach-code"
                        ref={refs.coachCode}
                        type="text" 
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-invalid={errors.coachCode ? 'true' : undefined}
                        aria-describedby="register-coach-error"
                        onBlur={handleBlurCoachCode}
                        onChange={(e) => { setCoachCode(e.target.value); setCoachName(null); setCoachMessage(''); }} 
                        value={coachCode}
                        className={`w-full bg-amber-50/10 dark:bg-[#1F2937]/50 border p-3 pl-12 rounded-xl outline-none focus:ring-2 focus:ring-brand dark:text-white transition-all font-mono tracking-wider text-sm ${coachName ? 'border-green-500' : 'border-gray-200 dark:border-gray-800'}`}
                        placeholder="Ex: CÓDIGO-DO-COACH"
                    />
                    {isCheckingCode && <div role="status" aria-label="Verificando código" className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 border-2 border-brand rounded-full border-t-transparent"></div>}
                </div>
                <p id="register-coach-error" role="alert" aria-live="assertive" className={errors.coachCode ? 'mt-1.5 text-sm font-medium text-red-500' : 'sr-only'}>
                    {errors.coachCode || ''}
                </p>
                {coachMessage && !errors.coachCode && <p role="status" className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">{coachMessage}</p>}
                {/* Feedback Visual do Nome do Coach */}
                {coachName && (
                    <div className="mt-2 flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg text-xs font-bold animate-fade-in border border-green-200 dark:border-green-950">
                        <Check className="h-4 w-4 text-green-600" />
                        Treinador: {coachName}
                    </div>
                )}
            </div>

            <div>
              <label htmlFor="register-terms" className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                <input
                  id="register-terms"
                  ref={refs.terms}
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  aria-invalid={errors.terms ? 'true' : undefined}
                  aria-describedby="register-terms-error"
                  className="mt-1 h-5 w-5 shrink-0 accent-[#FFC107]"
                />
                <span>
                  Li e aceito os <Link to="/termos" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-700 underline dark:text-brand">Termos de Uso</Link> e a{' '}
                  <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-700 underline dark:text-brand">Política de Privacidade</Link>,
                  inclusive o tratamento dos meus dados de saúde para acompanhar meus treinos.
                </span>
              </label>
              <p id="register-terms-error" role="alert" className={errors.terms ? 'mt-1 text-sm font-medium text-red-500' : 'sr-only'}>{errors.terms || ''}</p>
            </div>

            <button
              type="submit"
              disabled={localLoading || isCheckingCode}
              aria-busy={localLoading}
              className="w-full flex items-center justify-center min-h-[56px] px-4 rounded-2xl shadow-lg shadow-brand/25 text-base font-black text-black bg-gradient-to-r from-brand to-[#FF9800] hover:shadow-[0_0_24px_rgba(255,193,7,0.4)] transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {localLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                    Processando...
                  </span>
              ) : 'Cadastrar Gratuitamente'}
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Já tem conta?{' '}
              <Link to="/login" className="font-bold text-amber-700 dark:text-brand hover:text-brand-dark transition-colors">
                Fazer Login
              </Link>
            </p>
            <p className="mt-3 text-center text-[11px] leading-snug text-gray-600 dark:text-gray-400">
              Protegido pelo reCAPTCHA. Valem a <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">Política de Privacidade do Google</a> e os <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">Termos de Serviço do Google</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}