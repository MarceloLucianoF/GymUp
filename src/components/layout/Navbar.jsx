import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../hooks/AuthContext';
import { useAdmin } from '../../hooks/useAdmin';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import { Home, Dumbbell, Calendar, User, Shield, MessageSquare, Flame, TrendingUp, Users, LayoutDashboard } from 'lucide-react';

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
      setActiveSession(user ? activeWorkoutService.getActiveSession(user.uid) : null);
    };
    updateSession();
    window.addEventListener('active-workout-updated', updateSession);
    return () => window.removeEventListener('active-workout-updated', updateSession);
  }, [user, location]);

  const role = userProfile?.role;
  const isStaff = role === 'coach' || role === 'admin';

  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/') return true;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const avatarUrl = userProfile?.photoURL || user?.photoURL;
  const displayName = userProfile?.displayName || user?.displayName;
  const initial = displayName?.charAt(0).toUpperCase() || 'U';

  const trainingsTarget = activeSession ? `/execution/${activeSession.trainingId}` : '/trainings';

  // Itens por papel. `match` lista os prefixos que ativam o item.
  const items = isStaff
    ? [
        { to: '/coach/dashboard', label: 'Painel', icon: LayoutDashboard, match: ['/coach/dashboard'] },
        { to: '/coach/students', label: 'Alunos', icon: Users, match: ['/coach/students'] },
        { to: '/admin/trainings', label: 'Treinos', icon: Dumbbell, match: ['/admin/trainings', '/admin/exercises'] },
        { to: '/coach/chat', label: 'Chat', icon: MessageSquare, match: ['/coach/chat'] },
        { to: '/profile', label: 'Perfil', icon: User, match: ['/profile'], avatar: true },
      ]
    : [
        { to: '/dashboard', label: 'Início', icon: Home, match: ['/dashboard'] },
        { to: trainingsTarget, label: 'Treinos', icon: Dumbbell, match: ['/trainings', '/training', '/execution'], live: !!activeSession },
        { to: '/measurements', label: 'Evolução', icon: TrendingUp, match: ['/measurements', '/analytics'] },
        { to: '/history', label: 'Histórico', icon: Calendar, match: ['/history'] },
        { to: '/profile', label: 'Perfil', icon: User, match: ['/profile', '/chat'], avatar: true },
      ];

  const itemActive = (it) => it.match.some(isActive);
  const activeIndex = items.findIndex(itemActive);

  const Avatar = ({ size = 'w-6 h-6', active }) => (
    <span className={`${size} rounded-full overflow-hidden border-2 transition-colors ${active ? 'border-brand' : 'border-transparent'} flex items-center justify-center bg-gray-200 dark:bg-gray-700`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{initial}</span>
      )}
    </span>
  );

  return (
    <>
      {/* ================= DESKTOP TOPBAR ================= */}
      <nav aria-label="Navegação principal" className="hidden md:flex sticky top-0 z-50 h-20 border-b border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#0B0F19]/75 backdrop-blur-xl transition-colors">
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center gap-6">
          <Link to={isStaff ? '/coach/dashboard' : '/dashboard'} className="flex items-center gap-3 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="AcademyUp - início">
            <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-xl flex items-center justify-center border border-gray-200 dark:border-white/10 group-hover:scale-110 transition-transform p-1">
              <AcademyUpLogo className="w-full h-full text-gray-800 dark:text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-black text-gray-800 dark:text-white tracking-tighter leading-none">
                ACADEMY<span className="text-brand">UP</span>
              </span>
              <span className="text-[8px] text-gray-500 dark:text-gray-400 font-bold tracking-[0.2em] mt-0.5">TREINE • EVOLUA</span>
            </div>
          </Link>

          {user && (
            <div className="flex items-center gap-1 rounded-2xl bg-gray-100/80 dark:bg-white/5 p-1">
              {items.filter((it) => !it.avatar).map((it) => {
                const active = itemActive(it);
                const Icon = it.live ? Flame : it.icon;
                return (
                  <Link
                    key={it.label}
                    to={it.to}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-brand shadow-sm'
                        : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${it.live ? 'text-orange-500 animate-pulse' : active ? 'text-brand' : ''}`} aria-hidden="true" />
                    {it.label}
                  </Link>
                );
              })}
              {!isStaff && (
                <Link
                  to="/chat"
                  aria-current={isActive('/chat') ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    isActive('/chat') ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-brand shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" aria-hidden="true" /> Chat
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="ml-1 text-xs font-bold text-brand bg-brand/10 hover:bg-brand hover:text-black border border-brand/30 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" /> Painel Admin
                </Link>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/profile" className="flex items-center gap-3 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="Ver perfil">
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-brand transition-colors">{displayName}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Ver Perfil</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-2 border-transparent group-hover:border-brand transition-all shadow-sm">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Perfil" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-black font-bold">{initial}</div>
                  )}
                </div>
              </Link>
            ) : (
              <div className="flex gap-4 items-center">
                <Link to="/login" className="text-gray-600 dark:text-gray-300 font-bold hover:text-brand px-4 py-2 transition-colors">Login</Link>
                <Link to="/register" className="btn-primary-gradient text-sm px-6 py-2.5">Começar</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* BARRA GLOBAL DE TREINO ATIVO (MOBILE) */}
      {user && activeSession && !location.pathname.startsWith('/execution') && (
        <div
          className="md:hidden fixed left-3 right-3 z-40 animate-slide-up rounded-2xl bg-gradient-to-r from-brand to-[#FF9800] text-black px-4 py-2.5 flex items-center justify-between shadow-xl shadow-brand/20"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Flame className="w-4 h-4 text-black fill-current animate-pulse shrink-0" aria-hidden="true" />
            <div className="min-w-0 text-xs">
              <span className="font-black uppercase tracking-wider block leading-none text-[9px] opacity-80">Treino Ativo</span>
              <span className="font-bold truncate block">{activeSession.trainingName || 'Treino em andamento'} {activeSession.currentExerciseName ? `• ${activeSession.currentExerciseName}` : ''}</span>
            </div>
          </div>
          <Link
            to={`/execution/${activeSession.trainingId}`}
            className="bg-black text-brand font-black text-xs px-4 min-h-[44px] flex items-center rounded-xl shrink-0 pressable"
          >
            Continuar →
          </Link>
        </div>
      )}

      {/* ================= MOBILE BOTTOM BAR ================= */}
      {user && (
        <nav
          aria-label="Navegação principal"
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200/70 dark:border-white/10 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="relative grid h-16 grid-cols-5">
            {activeIndex >= 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 h-full w-1/5 flex justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateX(${activeIndex * 100}%)` }}
              >
                <span className="h-1 w-10 rounded-b-full bg-gradient-to-r from-brand to-[#FF9800] shadow-[0_2px_12px_rgba(255,193,7,0.7)]" />
              </span>
            )}
            {items.map((it) => {
              const active = itemActive(it);
              const Icon = it.live ? Flame : it.icon;
              return (
                <Link
                  key={it.label}
                  to={it.to}
                  aria-current={active ? 'page' : undefined}
                  aria-label={it.label}
                  className="relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 pressable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <span className={`relative transition-transform duration-300 ${active ? '-translate-y-0.5 scale-110' : ''}`}>
                    {it.avatar ? (
                      <Avatar active={active} />
                    ) : (
                      <Icon
                        className={`w-6 h-6 transition-colors ${it.live ? 'text-orange-500 fill-orange-500 animate-pulse' : active ? 'text-brand' : 'text-gray-500 dark:text-gray-400'}`}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className={`text-[10px] font-bold tracking-wide transition-colors ${active ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{it.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
