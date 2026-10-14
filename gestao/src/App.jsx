import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './session';
import Login from './pages/Login';
import Home from './pages/Home';
import AcademyPage from './pages/AcademyPage';
import InvitePage from './pages/InvitePage';

function Private({ children }) {
  const { user } = useSession();
  const location = useLocation();
  if (user === undefined) return <p role="status" className="center">Carregando...</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;   // volta ao convite depois de entrar
  return children;
}

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Private><Home /></Private>} />
        <Route path="/academia/:academyId" element={<Private><AcademyPage /></Private>} />
        <Route path="/convite/:code" element={<Private><InvitePage /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}
