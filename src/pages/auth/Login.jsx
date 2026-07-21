import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, authLoading, user } = useAuthContext();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(false);

  // Redireciona se já logado
  useEffect(() => {
    if (user) navigate('/home');
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalLoading(true);
    const toastId = toast.loading('Autenticando...');

    try {
      await login(email, password);
      toast.success('Bem-vindo de volta!', { id: toastId });
      // O useEffect redireciona
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erro ao entrar.", { id: toastId });
      setLocalLoading(false);
    }
  };

  if (authLoading) return null; // Evita flash

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#0D1117] transition-colors">
      
      {/* Lado Esquerdo (Visual - Igual ao Registro) */}
      <div className="hidden lg:flex w-1/2 bg-gray-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
        
        <div className="relative z-10 p-12 text-white max-w-lg">
          <h1 className="text-5xl font-black mb-6 leading-tight tracking-tight">
            ACADEMY<span className="text-[#FFC107]">UP</span>
          </h1>
          <p className="text-2xl font-light text-gray-200 mb-8 leading-relaxed">
            "A única repetição ruim é aquela que você não fez."
          </p>
          <div className="flex gap-2">
             <div className="h-1 w-12 bg-[#FFC107] rounded-full"></div>
             <div className="h-1 w-4 bg-gray-600 rounded-full"></div>
             <div className="h-1 w-4 bg-gray-600 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Lado Direito (Formulário) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-[#0D1117]">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          
          <div className="text-center lg:text-left">
            <h2 className="lg:hidden text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tighter">ACADEMY<span className="text-[#FFC107]">UP</span></h2>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Bem-vindo de volta!</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Digite suas credenciais para acessar sua ficha.</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              
              {/* Email */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FFC107] outline-none transition-all"
                  placeholder="seu@email.com"
                />
              </div>

              {/* Senha */}
              <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
                    <Link to="/forgot-password" className="text-xs font-bold text-[#FFC107] hover:text-[#FFB300] transition-colors">
                        Esqueceu a senha?
                    </Link>
                </div>
                <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FFC107] outline-none transition-all pr-12"
                      placeholder="••••••••"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex items-center justify-center"
                    >
                        {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                        ) : (
                            <Eye className="w-5 h-5" />
                        )}
                    </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={localLoading}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-[#FFC107]/20 text-sm font-black text-black bg-gradient-to-r from-[#FFC107] to-[#FF9800] hover:from-[#FFC107] hover:to-[#FFB300] transition-all transform active:scale-[0.98] hover:shadow-[0_0_20px_rgba(255,193,7,0.35)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {localLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    Entrando...
                  </span>
              ) : 'Acessar Conta'}
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Não tem uma conta?{' '}
              <Link to="/register" className="font-bold text-[#FFC107] hover:text-[#FFB300] transition-colors">
                Criar conta grátis
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}