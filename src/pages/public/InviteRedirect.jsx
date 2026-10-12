import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthContext } from '../../hooks/AuthContext';
import { normalizeCode } from '../../services/coachLinkService';

// /convite/<código>: quem ainda não tem conta vai ao cadastro com o código preenchido; aluno logado abre o pedido no perfil.
export default function InviteRedirect() {
  const { code } = useParams();
  const { user, userProfile, authLoading } = useAuthContext();
  const clean = encodeURIComponent(normalizeCode(code));
  if (authLoading) return null;
  if (!user) return <Navigate to={`/register?coach=${clean}`} replace />;
  if (userProfile?.role === 'user') return <Navigate to={`/profile?coach=${clean}`} replace />;
  return <Navigate to="/" replace />;
}
