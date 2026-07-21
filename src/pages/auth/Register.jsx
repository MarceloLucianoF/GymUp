import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Eye, EyeOff, KeyRound, Check } from 'lucide-react';

export default function Register() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Lógica do Convite
  const [coachCode, setCoachCode] = useState('');
  const [coachName, setCoachName] = useState(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
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

  const verifyCoach = async (code) => {
      if (!code) return;
      setIsCheckingCode(true);
      try {
          const coachRef = doc(db, 'users', code.trim());
          const coachSnap = await getDoc(coachRef);
          
          if (coachSnap.exists() && (coachSnap.data().role === 'coach' || coachSnap.data().role === 'admin')) {
              setCoachName(coachSnap.data().displayName);
              toast.success(`Treinador encontrado: ${coachSnap.data().displayName}`);
          } else {
              setCoachName(null);
              toast.error("Código de treinador inválido.");
          }
      } catch (err) {
          console.error(err);
      } finally {
          setIsCheckingCode(false);
      }
  };

  const handleBlurCoachCode = () => {
      if(coachCode && !coachName) verifyCoach(coachCode);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) return toast.error("As senhas não conferem!");
    if (password.length < 6) return toast.error("Senha muito curta (mínimo 6).");

    let verifiedCoachId = null;
    if (coachCode.trim()) {
        if (!coachName) {
             return toast.error("Verifique o código do treinador antes de continuar.");
        }
        verifiedCoachId = coachCode.trim();
    }

    setLocalLoading(true);
    const loadingToast = toast.loading('Criando sua conta...');

    try {
      await register(email, password, displayName, { 
          coachId: verifiedCoachId,
          currentTrainingId: null 
      });
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
          <h1 className="text-5xl font-black mb-6 leading-tight">Construa sua melhor versão.</h1>
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-[#0D1117]">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          
          <div className="text-center lg:text-left">
            <h2 className="lg:hidden text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tighter">ACADEMY<span className="text-[#FFC107]">UP</span></h2>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Crie sua conta</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Comece hoje mesmo.</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Nome Completo</label>
              <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FFC107] outline-none transition-all" placeholder="Ex: João Silva" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FFC107] outline-none transition-all" placeholder="seu@email.com" />
            </div>

            {/* Grid de Senhas */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Senha</label>
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            required 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FFC107] outline-none transition-all pr-10" 
                            placeholder="••••••" 
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)} 
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors flex items-center justify-center"
                        >
                            {showPassword ? (
                                <EyeOff className="w-5 h-5" />
                            ) : (
                                <Eye className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Confirmar</label>
                    <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FFC107] outline-none transition-all" 
                        placeholder="••••••" 
                    />
                </div>
            </div>

            {/* CAMPO DE CÓDIGO DO TREINADOR */}
            <div className="pt-2">
                <label className="text-xs font-bold text-[#FFC107] uppercase ml-1 flex justify-between cursor-pointer group">
                    <span>Código do Treinador (Opcional)</span>
                    <span className="text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">Peça ao seu coach</span>
                </label>
                <div className="relative mt-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 flex items-center justify-center">
                        <KeyRound className="w-5 h-5" />
                    </div>
                    <input 
                        type="text" 
                        onBlur={handleBlurCoachCode}
                        onChange={(e) => { setCoachCode(e.target.value); setCoachName(null); }} 
                        value={coachCode}
                        className={`w-full bg-amber-50/10 dark:bg-[#1F2937]/50 border p-3 pl-12 rounded-xl outline-none focus:ring-2 focus:ring-[#FFC107] dark:text-white transition-all font-mono tracking-wider text-sm ${coachName ? 'border-green-500' : 'border-gray-200 dark:border-gray-800'}`}
                        placeholder="Ex: CÓDIGO-DO-COACH"
                    />
                    {isCheckingCode && <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 border-2 border-[#FFC107] rounded-full border-t-transparent"></div>}
                </div>
                {/* Feedback Visual do Nome do Coach */}
                {coachName && (
                    <div className="mt-2 flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg text-xs font-bold animate-fade-in border border-green-200 dark:border-green-950">
                        <Check className="h-4 w-4 text-green-600" />
                        Treinador: {coachName}
                    </div>
                )}
            </div>

            <button
              type="submit"
              disabled={localLoading || isCheckingCode}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-[#FFC107]/20 text-sm font-black text-black bg-gradient-to-r from-[#FFC107] to-[#FF9800] hover:from-[#FFC107] hover:to-[#FFB300] transition-all transform active:scale-[0.98] hover:shadow-[0_0_20px_rgba(255,193,7,0.35)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {localLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    Processando...
                  </span>
              ) : 'Cadastrar Gratuitamente'}
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Já tem conta?{' '}
              <Link to="/login" className="font-bold text-[#FFC107] hover:text-[#FFB300] transition-colors">
                Fazer Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}