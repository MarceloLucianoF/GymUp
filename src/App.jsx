import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './hooks/AuthContext';
import { ThemeProvider } from './hooks/ThemeContext';
import { Toaster } from 'react-hot-toast';

// --- PÁGINAS: AUTH ---
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// --- PÁGINAS: USER (ALUNO) ---
import Home from './pages/user/Home';
import TrainingsPage from './pages/user/TrainingsPage'; 
import TrainingPage from './pages/user/TrainingPage';    
import TrainingExecutionPage from './pages/user/TrainingExecutionPage';
import HistoryPage from './pages/user/HistoryPage';
import Profile from './pages/user/Profile';
import MeasurementsPage from './pages/user/MeasurementsPage'; // ✅ NOVO
import ExerciseAnalytics from './pages/user/ExerciseAnalytics'; // ✅ NOVO
import UserChatPage from './pages/user/UserChatPage'; // ✅ Novo
import WorkoutDetailsPage from './pages/user/WorkoutDetailsPage'; // ✅ Novo


// --- PÁGINAS: ADMIN (TREINADOR) ---
import AdminPanel from './pages/admin/AdminPanel';
import ExerciseLibrary from './pages/admin/ExerciseLibrary'; // ✅ Importar
import WorkoutEditor from './pages/admin/WorkoutEditor';
import CoachTrainingsPage from './pages/admin/CoachTrainingsPage'; // ✅ Novo nome

// --- PÁGINAS: COACH ---
import CoachHome from './pages/coach/CoachHome';
import CoachChatPage from './pages/coach/CoachChatPage';
import CoachStudentsPage from './pages/coach/CoachStudentsPage'; // ✅ Novo
import FinancialPage from './pages/coach/FinancialPage'; // ✅ Importar
import StudentDetailsPage from './pages/coach/StudentDetailsPage'; // ✅ Importar
import CoachSettings from './pages/coach/CoachSettings'; // ✅ Importar

// --- COMPONENTES ---
import Navbar from './components/layout/Navbar';
import LandingPage from './pages/public/LandingPage';   // ✅ Importar

// --- COMPONENTE DE ROTA PROTEGIDA ---
const ProtectedRoute = ({ children }) => {
  // Nota: Verifique se seu hook exporta 'authIsReady' ou 'loading'. 
  // Vou usar 'authIsReady' pois é mais robusto para Firebase, mas mantendo fallback.
  const { user, authIsReady, loading } = useAuthContext();
  
  const isWait = authIsReady === false || loading === true;

  if (isWait) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
       {/* Navbar só aparece para logados */}
       <Navbar /> 
       {children}
    </>
  );
};

// --- DEFINIÇÃO DAS ROTAS ---
function AppRoutes() {
  const { user } = useAuthContext();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Routes>
          {/* --- ROTAS PÚBLICAS --- */}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/home" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/home" />} />
          
          <Route path="/" element={<Navigate to={user ? "/home" : "/login"} replace />} />
          <Route path="/" element={!user ? <LandingPage /> : <Navigate to={user.role === 'coach' ? '/coach/dashboard' : '/home'} />} />
          <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/home" />} />
          
          
          {/* --- ROTAS PROTEGIDAS (ALUNO) --- */}
          <Route path="/history/:checkInId" element={<ProtectedRoute><WorkoutDetailsPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><UserChatPage /></ProtectedRoute>} />
          
          {/* Dashboard & Perfil */}
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/measurements" element={<ProtectedRoute><MeasurementsPage /></ProtectedRoute>} /> {/* 🔥 Dashboard Evolução */}

          
          {/* Fluxo de Treino */}
          <Route path="/trainings" element={<ProtectedRoute><TrainingsPage /></ProtectedRoute>} />
          <Route path="/training/:trainingId" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
          <Route path="/execution/:trainingId" element={<ProtectedRoute><TrainingExecutionPage /></ProtectedRoute>} />
          
          {/* Histórico & Analytics */}
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/analytics/:exerciseName" element={<ProtectedRoute><ExerciseAnalytics /></ProtectedRoute>} /> {/* 🔥 Performance */}

          {/* Chat com Coach */}
          <Route path="/chat" element={<ProtectedRoute><UserChatPage /></ProtectedRoute>} />
          
          {/* --- ROTAS PROTEGIDAS (ADMIN) --- */}
          {/* Mantendo compatibilidade com seu AdminPanel antigo e adicionando o novo Gestor */}
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/admin/exercises" element={<ProtectedRoute><ExerciseLibrary /></ProtectedRoute>} />
          <Route path="/admin/trainings" element={<ProtectedRoute><CoachTrainingsPage /></ProtectedRoute>} />
          <Route path="/admin/trainings/:trainingId" element={<ProtectedRoute><WorkoutEditor /></ProtectedRoute>} />

          {/* --- ROTAS DO COACH (PAINEL DE GESTÃO) --- */}
          <Route path="/coach/dashboard" element={<ProtectedRoute><CoachHome /></ProtectedRoute>} />
          <Route path="/coach/chat" element={<ProtectedRoute><CoachChatPage /></ProtectedRoute>} />
          <Route path="/coach/students" element={<ProtectedRoute><CoachStudentsPage /></ProtectedRoute>} />
          <Route path="/coach/financial" element={<ProtectedRoute><FinancialPage /></ProtectedRoute>} />
          <Route path="/coach/students/:studentId" element={<ProtectedRoute><StudentDetailsPage /></ProtectedRoute>} />
          <Route path="/coach/settings" element={<ProtectedRoute><CoachSettings /></ProtectedRoute>} />

          {/* Rota 404/Fallback */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
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