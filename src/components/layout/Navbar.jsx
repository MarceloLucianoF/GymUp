import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../hooks/AuthContext';
import { useAdmin } from '../../hooks/useAdmin';
import { Home, Dumbbell, Calendar, Bot, User, Shield } from 'lucide-react';

// --- LOGO DEFINITIVO (Geometry Solid) ---
const AcademyLogo = ({ className, isWhite = false }) => {
  const uniqueId = "grad_" + Math.random().toString(36).substr(2, 9);

  return (
    <svg 
      viewBox="0 0 24 24" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      {!isWhite && (
        <defs>
          <linearGradient id={uniqueId} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#9333EA" />
          </linearGradient>
        </defs>
      )}

      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M12 2L2 21H7L12 11L17 21H22L12 2ZM12 6.5L14.5 11.5H9.5L12 6.5Z" 
        fill={isWhite ? "white" : `url(#${uniqueId})`}
      />
      
      <rect 
        x="10" 
        y="18" 
        width="4" 
        height="3" 
        rx="1" 
        fill={isWhite ? "white" : `url(#${uniqueId})`}
        className={isWhite ? "opacity-50" : "opacity-40"}
      />
    </svg>
  );
};

export default function Navbar() {
  const { user, userProfile } = useAuthContext();
  const { isAdmin } = useAdmin();
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/home' && location.pathname === '/') return true;
    return location.pathname.startsWith(path);
  };

  const avatarUrl = userProfile?.photoURL || user?.photoURL;
  const displayName = userProfile?.displayName || user?.displayName;
  const initial = displayName?.charAt(0).toUpperCase() || 'U';

  const Icons = {
    Home: ({ active }) => (
      <Home className={`w-6 h-6 transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
    ),
    Trainings: ({ active }) => (
      <Dumbbell className={`w-6 h-6 transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
    ),
    History: ({ active }) => (
      <Calendar className={`w-6 h-6 transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
    ),
    Profile: ({ active }) => (
      <User className={`w-6 h-6 transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
    ),
  };

  return (
    <>
      {/* ================= DESKTOP NAVBAR ================= */}
      <nav className="hidden md:flex bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50 h-20 transition-colors">
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
          
          {/* Logo Oficial */}
          <Link to="/home" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-blue-50 dark:bg-gray-700 rounded-xl flex items-center justify-center border border-blue-100 dark:border-gray-600 group-hover:scale-110 transition-transform p-1.5">
               <AcademyLogo className="w-full h-full" />
            </div>
            <span className="text-2xl font-black text-gray-800 dark:text-white tracking-tighter">
              Academy<span className="text-blue-600">Up</span>
            </span>
          </Link>

          {/* Links Centrais */}
          {user && (
            <div className="flex items-center gap-8">
              <Link to="/home" className={`text-sm font-bold transition-colors hover:text-blue-600 ${isActive('/home') ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
                Dashboard
              </Link>
              <Link to="/trainings" className={`text-sm font-bold transition-colors hover:text-blue-600 ${isActive('/trainings') ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
                Treinos
              </Link>
              <Link to="/history" className={`text-sm font-bold transition-colors hover:text-blue-600 ${isActive('/history') ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
                Histórico
              </Link>
              <Link to="/agents" className={`text-sm font-bold transition-colors hover:text-blue-600 flex items-center gap-1.5 ${isActive('/agents') ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
                <Bot className="w-4 h-4" /> Agentes IA
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-sm font-bold text-orange-500 hover:text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full flex items-center gap-1">
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
                    <p className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-blue-600 transition-colors">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ver Perfil</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-2 border-transparent group-hover:border-blue-500 transition-all shadow-sm">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {initial}
                      </div>
                    )}
                  </div>
                </Link>
              </>
            ) : (
              <div className="flex gap-4">
                <Link to="/login" className="text-gray-600 dark:text-gray-300 font-bold hover:text-blue-600 py-2">Login</Link>
                <Link to="/register" className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-transform hover:scale-105">
                  Começar
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ================= MOBILE NAVBAR ================= */}
      {user && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 pb-safe z-50 transition-colors">
          <div className="flex justify-between items-center px-6 h-16 relative">
            
            <Link to="/home" className="flex flex-col items-center justify-center w-12 gap-1 group">
              <Icons.Home active={isActive('/home')} />
              <span className={`text-[10px] font-bold ${isActive('/home') ? 'text-blue-600' : 'text-gray-400'}`}>Home</span>
            </Link>

            <Link to="/trainings" className="flex flex-col items-center justify-center w-12 gap-1 group">
              <Icons.Trainings active={isActive('/trainings')} />
              <span className={`text-[10px] font-bold ${isActive('/trainings') ? 'text-blue-600' : 'text-gray-400'}`}>Treinos</span>
            </Link>

            {/* BOTÃO FLUTUANTE COM AGENTES IA */}
            <div className="relative -top-6">
                <Link 
                  to="/agents" 
                  className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-600/30 border-4 border-white dark:border-gray-800 transform active:scale-95 transition-all p-3"
                  title="Agentes IA"
                >
                  <Bot className="w-6 h-6 text-white" />
                </Link>
            </div>

            <Link to="/history" className="flex flex-col items-center justify-center w-12 gap-1 group">
              <Icons.History active={isActive('/history')} />
              <span className={`text-[10px] font-bold ${isActive('/history') ? 'text-blue-600' : 'text-gray-400'}`}>Histórico</span>
            </Link>

            <Link to="/profile" className="flex flex-col items-center justify-center w-12 gap-1 group">
              <div className={`w-6 h-6 rounded-full overflow-hidden border ${isActive('/profile') ? 'border-blue-600' : 'border-transparent'}`}>
                 {avatarUrl ? (
                    <img src={avatarUrl} alt="Me" className="w-full h-full object-cover" />
                 ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-500">
                        {initial}
                    </div>
                 )}
              </div>
              <span className={`text-[10px] font-bold ${isActive('/profile') ? 'text-blue-600' : 'text-gray-400'}`}>Perfil</span>
            </Link>

          </div>
        </div>
      )}
    </>
  );
}