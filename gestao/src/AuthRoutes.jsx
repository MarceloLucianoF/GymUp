import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './session';
import { Loading } from './components/ui';
import AppFrame from './components/AppFrame';

const Login = lazy(() => import('./pages/Login'));
const InviteAccept = lazy(() => import('./pages/InviteAccept'));
const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const AcademyPage = lazy(() => import('./pages/app/AcademyPage'));
const Members = lazy(() => import('./pages/app/Members'));
const Invites = lazy(() => import('./pages/app/Invites'));
const Audit = lazy(() => import('./pages/app/Audit'));
const Students = lazy(() => import('./pages/app/Students'));
const Trainings = lazy(() => import('./pages/app/Trainings'));
const TrainingDetail = lazy(() => import('./pages/app/TrainingDetail'));

function Private({ children }) {
  const { user } = useSession();
  const location = useLocation();
  if (user === undefined) return <div className="center"><Loading text="Verificando sua sessão..." /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;   // volta ao convite depois de entrar
  return children;
}

// Só esta árvore carrega Firebase Auth. As rotas /app ficam dentro de AppFrame (menu, academia atual).
export default function AuthRoutes() {
  return (
    <SessionProvider>
      <Suspense fallback={<div className="center"><Loading /></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/convite/:code" element={<Private><InviteAccept /></Private>} />
          <Route path="/app" element={<Private><AppFrame /></Private>}>
            <Route index element={<Dashboard />} />
            <Route path="academia/:academyId" element={<AcademyPage />} />
            <Route path="academia/:academyId/membros" element={<Members />} />
            <Route path="academia/:academyId/convites" element={<Invites />} />
            <Route path="academia/:academyId/auditoria" element={<Audit />} />
            <Route path="academia/:academyId/alunos" element={<Students />} />
            <Route path="academia/:academyId/fichas" element={<Trainings />} />
            <Route path="academia/:academyId/fichas/:templateId" element={<TrainingDetail />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SessionProvider>
  );
}
