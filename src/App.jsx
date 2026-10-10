import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './hooks/AuthContext';
import { ThemeProvider } from './hooks/ThemeContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import PwaLayer from './components/pwa/PwaLayer';
import ErrorBoundary from './components/common/ErrorBoundary';
import usePageMeta from './hooks/usePageMeta';

// --- PÁGINAS: AUTH ---
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));

// --- PÁGINAS: USER (ALUNO) ---
const Home = lazy(() => import('./pages/user/Home'));
const TrainingsPage = lazy(() => import('./pages/user/TrainingsPage'));
const TrainingPage = lazy(() => import('./pages/user/TrainingPage'));
const TrainingExecutionPage = lazy(() => import('./pages/user/TrainingExecutionPage'));
const HistoryPage = lazy(() => import('./pages/user/HistoryPage'));
const Profile = lazy(() => import('./pages/user/Profile'));
const MeasurementsPage = lazy(() => import('./pages/user/MeasurementsPage'));
const ExerciseAnalytics = lazy(() => import('./pages/user/ExerciseAnalytics'));
const ExerciseProgressList = lazy(() => import('./pages/user/ExerciseProgressList'));
const Onboarding = lazy(() => import('./pages/user/Onboarding'));
const UserChatPage = lazy(() => import('./pages/user/UserChatPage'));
const WorkoutDetailsPage = lazy(() => import('./pages/user/WorkoutDetailsPage'));
const Tools = lazy(() => import('./pages/user/Tools'));


// --- PÁGINAS: ADMIN (TREINADOR) ---
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
const ExerciseLibrary = lazy(() => import('./pages/admin/ExerciseLibrary'));
const WorkoutEditor = lazy(() => import('./pages/admin/WorkoutEditor'));
const CoachTrainingsPage = lazy(() => import('./pages/admin/CoachTrainingsPage'));

// --- PÁGINAS: COACH ---
const CoachHome = lazy(() => import('./pages/coach/CoachHome'));
const CoachChatPage = lazy(() => import('./pages/coach/CoachChatPage'));
const CoachStudentsPage = lazy(() => import('./pages/coach/CoachStudentsPage'));
const FinancialPage = lazy(() => import('./pages/coach/FinancialPage'));
const StudentDetailsPage = lazy(() => import('./pages/coach/StudentDetailsPage'));
const CoachSettings = lazy(() => import('./pages/coach/CoachSettings'));

// --- COMPONENTES ---
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const Privacidade = lazy(() => import('./pages/public/Privacidade'));
const Termos = lazy(() => import('./pages/public/Termos'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

// Título/descrição por rota. Privacidade, Termos e 404 definem os próprios metadados.
const ROUTE_META = [
  ['/login', 'Entrar', 'Acesse sua conta BohTreinar.', false],
  ['/register', 'Criar conta', 'Crie sua conta gratuita no BohTreinar.', false],
  ['/forgot-password', 'Recuperar senha', 'Recupere o acesso à sua conta.', false],
  ['/dashboard', 'Painel', 'Seu painel de treinos.', true],
  ['/trainings', 'Meus treinos', 'Suas fichas de treino.', true],
  ['/training', 'Treino', 'Detalhes do treino.', true],
  ['/execution', 'Treino em andamento', 'Execução do treino.', true],
  ['/history', 'Histórico', 'Histórico de treinos.', true],
  ['/analytics', 'Evolução por exercício', 'Evolução de carga por exercício.', true],
  ['/measurements', 'Medidas', 'Evolução das suas medidas.', true],
  ['/profile', 'Meu perfil', 'Dados, medidas e preferências.', true],
  ['/chat', 'Chat', 'Conversa com seu treinador.', true],
  ['/ferramentas', 'Ferramentas', 'Calculadoras e ferramentas de treino.', true],
  ['/onboarding', 'Bem-vindo', 'Configure seu perfil.', true],
  ['/coach', 'Painel do treinador', 'Gestão de alunos e fichas.', true],
  ['/admin', 'Administração', 'Área administrativa.', true]
];
const SELF_META = ['/privacidade', '/termos'];

export const metaForPath = (pathname) => {
  if (pathname === '/') return null; // Landing usa o título do index.html
  if (SELF_META.includes(pathname)) return null;
  const hit = ROUTE_META.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (hit) return { title: hit[1], description: hit[2], noindex: hit[3] };
  return null;
};
function RouteMeta() {
  const { pathname } = useLocation();
  const meta = metaForPath(pathname);
  usePageMeta(meta?.title, meta?.description, { noindex: !!meta?.noindex });
  return null;
}

// Ao trocar de rota, move o foco para o conteúdo principal (leitores de tela e teclado).
function RouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const id = window.requestAnimationFrame(() => {
      const target = document.getElementById('main-content') || document.querySelector('main') || document.querySelector('h1');
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: false });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}

const SkipLink = () => (
  <a
    href="#main-content"
    onClick={(e) => {
      const el = document.getElementById('main-content');
      if (el) { e.preventDefault(); el.focus(); el.scrollIntoView?.(); }
    }}
    className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-black"
  >
    Pular para o conteúdo
  </a>
);

const VALID_ROLES = ['user', 'coach', 'admin'];

const getRoleHome = (role) => {
  if (role === 'coach' || role === 'admin') return '/coach/dashboard';
  if (role === 'user') return '/dashboard';
  return null;
};

const LoadingScreen = () => (
  <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div>
  </div>
);

const ProfileAccessError = () => {
  const { logout } = useAuthContext();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-900">
      <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Perfil indisponível</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Não foi possível identificar as permissões desta conta. Entre novamente ou procure o suporte.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-black hover:bg-brand-dark"
        >
          Sair
        </button>
      </div>
    </div>
  );
};

// Aluno novo (sem objetivo definido e sem onboarding concluído/pulado) passa pelo onboarding.
const needsOnboarding = (profile) => profile?.role === 'user' && !profile.onboardedAt && !profile.goal;

const ProtectedRoute = ({ children, allowedRoles = VALID_ROLES }) => {
  const { user, userProfile, authLoading } = useAuthContext();
  const { pathname } = useLocation();

  if (authLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  const role = userProfile?.role;
  if (!VALID_ROLES.includes(role)) return <ProfileAccessError />;
  if (!allowedRoles.includes(role)) return <Navigate to={getRoleHome(role)} replace />;
  if (needsOnboarding(userProfile) && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;

  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="outline-none">{children}</main>
    </>
  );
};

const OnboardingRoute = ({ children }) => {
  const { user, userProfile, authLoading } = useAuthContext();

  if (authLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (userProfile?.role !== 'user') return <Navigate to={getRoleHome(userProfile?.role) || '/'} replace />;
  if (!needsOnboarding(userProfile)) return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { user, userProfile, authLoading } = useAuthContext();

  if (authLoading) return <LoadingScreen />;
  if (!user) return <main id="main-content" tabIndex={-1} className="outline-none">{children}</main>;

  const destination = getRoleHome(userProfile?.role);
  return destination ? <Navigate to={destination} replace /> : <ProfileAccessError />;
};

const RoleRedirect = () => {
  const { user, userProfile, authLoading } = useAuthContext();

  if (authLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  const destination = getRoleHome(userProfile?.role);
  return destination ? <Navigate to={destination} replace /> : <ProfileAccessError />;
};

// --- DEFINIÇÃO DAS ROTAS ---
function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <SkipLink />
        <RouteMeta />
        <RouteFocus />
        <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* --- ROTAS PÚBLICAS --- */}
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/home" element={<RoleRedirect />} />
          
          {/* --- ROTAS PROTEGIDAS (ALUNO) --- */}
          <Route path="/history/:checkInId" element={<ProtectedRoute allowedRoles={['user']}><WorkoutDetailsPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute allowedRoles={['user']}><UserChatPage /></ProtectedRoute>} />
          
          {/* Dashboard & Perfil */}
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['user']}><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/ferramentas" element={<ProtectedRoute allowedRoles={['user']}><Tools /></ProtectedRoute>} />
          <Route path="/measurements" element={<ProtectedRoute allowedRoles={['user']}><MeasurementsPage /></ProtectedRoute>} /> {/* 🔥 Dashboard Evolução */}

          
          {/* Fluxo de Treino */}
          <Route path="/trainings" element={<ProtectedRoute allowedRoles={['user']}><TrainingsPage /></ProtectedRoute>} />
          <Route path="/training/:trainingId" element={<ProtectedRoute allowedRoles={['user']}><TrainingPage /></ProtectedRoute>} />
          <Route path="/execution/:trainingId" element={<ProtectedRoute allowedRoles={['user']}><TrainingExecutionPage /></ProtectedRoute>} />
          
          {/* Histórico & Analytics */}
          <Route path="/history" element={<ProtectedRoute allowedRoles={['user']}><HistoryPage /></ProtectedRoute>} />
          <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
          <Route path="/analytics" element={<ProtectedRoute allowedRoles={['user']}><ExerciseProgressList /></ProtectedRoute>} />
          <Route path="/analytics/:exerciseName" element={<ProtectedRoute allowedRoles={['user']}><ExerciseAnalytics /></ProtectedRoute>} /> {/* 🔥 Performance */}
          
          {/* --- ROTAS PROTEGIDAS (ADMIN) --- */}
          {/* Mantendo compatibilidade com seu AdminPanel antigo e adicionando o novo Gestor */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPanel /></ProtectedRoute>} />
          <Route path="/admin/exercises" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><ExerciseLibrary /></ProtectedRoute>} />
          <Route path="/admin/trainings" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><CoachTrainingsPage /></ProtectedRoute>} />
          <Route path="/admin/trainings/:trainingId" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><WorkoutEditor /></ProtectedRoute>} />

          {/* --- ROTAS DO COACH (PAINEL DE GESTÃO) --- */}
          <Route path="/coach/dashboard" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><CoachHome /></ProtectedRoute>} />
          <Route path="/coach/chat" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><CoachChatPage /></ProtectedRoute>} />
          <Route path="/coach/students" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><CoachStudentsPage /></ProtectedRoute>} />
          <Route path="/coach/financial" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><FinancialPage /></ProtectedRoute>} />
          <Route path="/coach/students/:studentId" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><StudentDetailsPage /></ProtectedRoute>} />
          <Route path="/coach/settings" element={<ProtectedRoute allowedRoles={['coach', 'admin']}><CoachSettings /></ProtectedRoute>} />

          {/* 404 de verdade para rotas desconhecidas */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
    </div>
  );
}

// --- APP PRINCIPAL (PROVIDERS) ---
export default function App() {
  return (
    <ErrorBoundary>
    <Router>
      <AuthProvider>
        <ThemeProvider>
          
          {/* As rotas ficam aqui dentro para ter acesso aos contextos */}
          <AppRoutes />
          <PwaLayer />
          
          <Toaster 
            position="top-center"
            toastOptions={{
              style: { 
                background: '#1f2937', // dark-gray-800
                color: '#fff',
                borderRadius: '12px',
                padding: '16px',
              },
              success: {
                iconTheme: { primary: '#10B981', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#EF4444', secondary: '#fff' },
              },
            }}
          />
          
        </ThemeProvider>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
}
