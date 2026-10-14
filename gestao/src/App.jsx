import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loading } from './components/ui';

// JS dividido por rota: a landing não carrega Firebase nem o painel; cada tela do app vem sob demanda.
const Landing = lazy(() => import('./pages/landing/Landing'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const AuthRoutes = lazy(() => import('./AuthRoutes'));

export default function App() {
  return (
    <Suspense fallback={<div className="center"><Loading /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="/login" element={<AuthRoutes />} />
        <Route path="/convite/:code" element={<AuthRoutes />} />
        <Route path="/app/*" element={<AuthRoutes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
