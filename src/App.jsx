import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './hooks/AuthContext';
import { ThemeProvider } from './hooks/ThemeContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';

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
const UserChatPage = lazy(() => import('./pages/user/UserChatPage'));
const WorkoutDetailsPage = lazy(() => import('./pages/user/WorkoutDetailsPage'));


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

const ProtectedRoute = ({ children, allowedRoles = VALID_ROLES }) => {
  const { user, userProfile, authLoading } = useAuthContext();

  if (authLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  const role = userProfile?.role;
  if (!VALID_ROLES.includes(role)) return <ProfileAccessError />;
  if (!allowedRoles.includes(role)) return <Navigate to={getRoleHome(role)} replace />;

  return (
    <>
      <Navbar />
      {children}
    </>
  );
};

const PublicOnlyRoute = ({ children }) => {
  const { user, userProfile, authLoading } = useAuthContext();

  if (authLoading) return <LoadingScreen />;
  if (!user) return children;

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
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* --- ROTAS PÚBLICAS --- */}
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<RoleRedirect />} />
          
          {/* --- ROTAS PROTEGIDAS (ALUNO) --- */}
          <Route path="/history/:checkInId" element={<ProtectedRoute allowedRoles={['user']}><WorkoutDetailsPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute allowedRoles={['user']}><UserChatPage /></ProtectedRoute>} />
          
          {/* Dashboard & Perfil */}
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['user']}><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/measurements" element={<ProtectedRoute allowedRoles={['user']}><MeasurementsPage /></ProtectedRoute>} /> {/* 🔥 Dashboard Evolução */}

          
          {/* Fluxo de Treino */}
          <Route path="/trainings" element={<ProtectedRoute allowedRoles={['user']}><TrainingsPage /></ProtectedRoute>} />
          <Route path="/training/:trainingId" element={<ProtectedRoute allowedRoles={['user']}><TrainingPage /></ProtectedRoute>} />
          <Route path="/execution/:trainingId" element={<ProtectedRoute allowedRoles={['user']}><TrainingExecutionPage /></ProtectedRoute>} />
          
          {/* Histórico & Analytics */}
          <Route path="/history" element={<ProtectedRoute allowedRoles={['user']}><HistoryPage /></ProtectedRoute>} />
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

          {/* Rota 404/Fallback */}
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
        </Suspense>
    </div>
  );
}

// --- APP PRINCIPAL (PROVIDERS) ---
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          
          {/* As rotas ficam aqui dentro para ter acesso aos contextos */}
          <AppRoutes />
          
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
  );
}
