import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../hooks/AuthContext';
import { useAdmin } from '../../hooks/useAdmin';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import { Home, Dumbbell, Calendar, User, Shield, MessageSquare, Flame } from 'lucide-react';

// --- LOGO OFICIAL DA MARCA (A + U + Halter + Seta) ---
const AcademyUpLogo = ({ className = "w-10 h-10" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* O "A" (Academy) */}
      <path 
        d="M 22 80 L 46 22 C 48 17, 52 17, 54 22 L 78 80" 
        stroke="currentColor" 
        strokeWidth="9" 
        strokeLinecap="round" 
        fill="none" 
      />
      {/* Barra do halter (travessão do A) */}
      <line 
        x1="31" 
        y1="58" 
        x2="69" 
        y2="58" 
        stroke="currentColor" 
        strokeWidth="9" 
        strokeLinecap="round" 
      />
      {/* Anilhas do halter nas pontas */}
      <rect x="26" y="49" width="6" height="18" rx="2" fill="#FFC107" />
      <rect x="68" y="49" width="6" height="18" rx="2" fill="#FFC107" />
      
      {/* O "U" (Up / Evolução) que envolve a perna direita */}
      <path 
        d="M 50 56 C 50 82, 76 82, 76 56 L 76 34" 
        stroke="#FFC107" 
        strokeWidth="9" 
        strokeLinecap="round" 
        fill="none" 
      />
      
      {/* Seta para cima no topo do U */}
      <path 
        d="M 67 42 L 76 32 L 85 42" 
        stroke="#FFB300" 
        strokeWidth="9" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none" 
      />
    </svg>
  );
};

export default function Navbar() {
  const { user, userProfile } = useAuthContext();
  const { isAdmin } = useAdmin();
  const location = useLocation();
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    const updateSession = () => {
      if (user) {
        const session = activeWorkoutService.getActiveSession(user.uid);
        setActiveSession(session);
      } else {
        setActiveSession(null);
      }
    };

    updateSession();
    window.addEventListener('active-workout-updated', updateSession);
    return () => window.removeEventListener('active-workout-updated', updateSession);
  }, [user, location]);

  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/') return true;
    return location.pathname.startsWith(path);
  };

  const avatarUrl = userProfile?.photoURL || user?.photoURL;
  const displayName = userProfile?.displayName || user?.displayName;
  const initial = displayName?.charAt(0).toUpperCase() || 'U';

  const Icons = {
    Home: ({ active }) => (
      <Home className={`w-6 h-6 transition-colors ${active ? 'text-[#FFC107]' : 'text-gray-400'}`} />
    ),
    Trainings: ({ active }) => (
      <Dumbbell className={`w-6 h-6 transition-colors ${active ? 'text-[#FFC107]' : 'text-gray-400'}`} />
    ),
    History: ({ active }) => (
      <Calendar className={`w-6 h-6 transition-colors ${active ? 'text-[#FFC107]' : 'text-gray-400'}`} />
    ),
    Profile: ({ active }) => (
      <User className={`w-6 h-6 transition-colors ${active ? 'text-[#FFC107]' : 'text-gray-400'}`} />
    ),
  };

  return (
    <>
      {/* ================= DESKTOP NAVBAR ================= */}
      <nav className="hidden md:flex bg-white dark:bg-[#1F2937] shadow-sm border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 h-20 transition-colors">
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
          
          {/* Logo Oficial */}
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-900 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-700 group-hover:scale-110 transition-transform p-1">
               <AcademyUpLogo className="w-full h-full text-gray-800 dark:text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-gray-800 dark:text-white tracking-tighter leading-none">
                ACADEMY<span className="text-[#FFC107]">UP</span>
              </span>
              <span className="text-[7px] text-gray-400 dark:text-gray-500 font-bold tracking-[0.2em] mt-0.5">TREINE • EVOLUA</span>
            </div>
          </Link>

           {/* Links Centrais */}
          {user && (
            <div className="flex items-center gap-8">
              <Link 
                to="/dashboard" 
                className={`text-sm font-bold transition-all relative py-2 hover:text-[#FFC107] ${
                  isActive('/dashboard') ? 'text-[#FFC107] dark:text-[#FFC107]' : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                Dashboard
                {isActive('/dashboard') && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#FFC107] rounded-full shadow-[0_0_8px_#FFC107] animate-pulse"></span>
                )}
              </Link>
              <Link 
                to="/trainings" 
                className={`text-sm font-bold transition-all relative py-2 hover:text-[#FFC107] ${
                  isActive('/trainings') ? 'text-[#FFC107] dark:text-[#FFC107]' : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                Treinos
                {isActive('/trainings') && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#FFC107] rounded-full shadow-[0_0_8px_#FFC107] animate-pulse"></span>
                )}
              </Link>
              <Link 
                to="/history" 
                className={`text-sm font-bold transition-all relative py-2 hover:text-[#FFC107] ${
                  isActive('/history') ? 'text-[#FFC107] dark:text-[#FFC107]' : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                Histórico
                {isActive('/history') && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#FFC107] rounded-full shadow-[0_0_8px_#FFC107] animate-pulse"></span>
                )}
              </Link>
              <Link 
                to={userProfile?.role === 'coach' ? "/coach/chat" : "/chat"} 
                className={`text-sm font-bold transition-all relative py-2 hover:text-[#FFC107] flex items-center gap-1.5 ${
                  isActive('/chat') || isActive('/coach/chat') ? 'text-[#FFC107] dark:text-[#FFC107]' : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                <MessageSquare className="w-4 h-4" /> Chat
                {(isActive('/chat') || isActive('/coach/chat')) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#FFC107] rounded-full shadow-[0_0_8px_#FFC107] animate-pulse"></span>
                )}
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-xs font-bold text-[#FFC107] hover:text-black bg-[#FFC107]/10 hover:bg-[#FFC107] border border-[#FFC107]/30 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm">
                  <Shield className="w-3.5 h-3.5" /> Painel Admin
                </Link>
              )}
            </div>
          )}

          {/* Avatar / Login */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
                <Link to="/profile" className="flex items-center gap-3 group">
                  <div className="text-right hidden lg:block">
                    <p className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-[#FFC107] transition-colors">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ver Perfil</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-2 border-transparent group-hover:border-[#FFC107] transition-all shadow-sm">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#FFC107] to-[#FFB300] flex items-center justify-center text-black font-bold">
                        {initial}
                      </div>
                    )}
                  </div>
                </Link>
              </>
            ) : (
              <div className="flex gap-4 items-center">
                <Link to="/login" className="text-gray-600 dark:text-gray-300 font-bold hover:text-[#FFC107] px-4 py-2 transition-colors">Login</Link>
                <Link to="/register" className="btn-primary-gradient text-sm px-6 py-2.5">
                  Começar
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* BARRA PERSISTENTE GLOBAL DE TREINO ATIVO (MOBILE) */}
      {user && activeSession && !location.pathname.startsWith('/execution') && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-black px-4 py-2 flex items-center justify-between shadow-2xl border-b border-black/10">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Flame className="w-4 h-4 text-black fill-current animate-pulse shrink-0" />
            <div className="min-w-0 text-xs">
              <span className="font-black uppercase tracking-wider block leading-none text-[9px] opacity-80">Treino Ativo</span>
              <span className="font-bold truncate block">{activeSession.trainingName || 'Treino em andamento'} {activeSession.currentExerciseName ? `• ${activeSession.currentExerciseName}` : ''}</span>
            </div>
          </div>
          <Link
            to={`/execution/${activeSession.trainingId}`}
            className="bg-black text-[#FFC107] font-black text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shrink-0 hover:bg-gray-900 transition-colors shadow-sm"
          >
            Continuar →
          </Link>
        </div>
      )}

      {/* ================= MOBILE NAVBAR ================= */}
      {user && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1F2937]/90 dark:backdrop-blur-md border-t border-gray-200 dark:border-gray-800 pb-safe z-50 transition-colors">
          <div className="flex justify-between items-center px-4 h-16 relative">
            
            <Link 
              to="/dashboard" 
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 px-3.5 transition-all duration-300 ${
                isActive('/dashboard') ? 'bg-[#FFC107]/10 text-[#FFC107]' : 'text-gray-400 hover:text-[#FFC107]'
              }`}
            >
              <Icons.Home active={isActive('/dashboard')} />
              <span className="text-[9px] font-black tracking-wide mt-0.5">Início</span>
            </Link>

            <Link 
              to={activeSession ? `/execution/${activeSession.trainingId}` : "/trainings"} 
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 px-3.5 transition-all duration-300 relative ${
                isActive('/trainings') || isActive('/execution') ? 'bg-[#FFC107]/10 text-[#FFC107]' : 'text-gray-400 hover:text-[#FFC107]'
              }`}
            >
              {activeSession ? (
                <div className="relative">
                  <Flame className="w-5 h-5 text-orange-400 fill-orange-400 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
                </div>
              ) : (
                <Icons.Trainings active={isActive('/trainings')} />
              )}
              <span className={`text-[9px] font-black tracking-wide mt-0.5 ${activeSession ? 'text-orange-400' : ''}`}>
                {activeSession ? 'Treinos 🔥' : 'Treinos'}
              </span>
            </Link>

            {/* BOTÃO FLUTUANTE COM CHAT */}
            <div className="relative -top-5">
                <Link 
                  to={userProfile?.role === 'coach' ? "/coach/chat" : "/chat"} 
                  className="w-12 h-12 bg-gradient-to-br from-[#FFC107] to-[#FF9800] rounded-full flex items-center justify-center shadow-lg shadow-[#FFC107]/25 border-4 border-white dark:border-[#0B0F19] transform hover:scale-110 active:scale-95 transition-all p-2.5"
                  title="Chat"
                >
                  <MessageSquare className="w-5 h-5 text-black fill-current" />
                </Link>
            </div>

            <Link 
              to="/history" 
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 px-3.5 transition-all duration-300 ${
                isActive('/history') ? 'bg-[#FFC107]/10 text-[#FFC107]' : 'text-gray-400 hover:text-[#FFC107]'
              }`}
            >
              <Icons.History active={isActive('/history')} />
              <span className="text-[9px] font-black tracking-wide mt-0.5">Diário</span>
            </Link>

            <Link 
              to="/profile" 
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 px-3.5 transition-all duration-300 ${
                isActive('/profile') ? 'bg-[#FFC107]/10 text-[#FFC107]' : 'text-gray-400 hover:text-[#FFC107]'
              }`}
            >
              <div className={`w-5 h-5 rounded-full overflow-hidden border transition-all ${isActive('/profile') ? 'border-[#FFC107]' : 'border-transparent'}`}>
                 {avatarUrl ? (
                    <img src={avatarUrl} alt="Perfil" className="w-full h-full object-cover" />
                 ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-500">
                        {initial}
                    </div>
                 )}
              </div>
              <span className="text-[9px] font-black tracking-wide mt-0.5">Perfil</span>
            </Link>

          </div>
        </div>
      )}
    </>
  );
}