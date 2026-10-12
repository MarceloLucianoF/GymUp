import React, { useState } from 'react';
import { Link2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import CoachLinkModal from './CoachLinkModal';
import useMyCoach from '../../hooks/useMyCoach';

const COPY = {
  none: { title: 'Sem treinador', text: 'Encontre um treinador ou use um código de convite.', cta: 'Encontrar treinador' },
  pending: { title: 'Solicitação enviada', text: 'Aguardando o treinador aceitar.', cta: 'Ver solicitação' },
  rejected: { title: 'Solicitação recusada', text: 'Você pode procurar outro treinador.', cta: 'Procurar outro' },
  revoked: { title: 'Vínculo encerrado', text: 'Seus dados continuam com você.', cta: 'Procurar treinador' }
};

// Cartão "Meu treinador" do perfil: mostra o estado e abre o painel de gestão do vínculo.
export default function MyCoachCard({ user, profile, onChanged, initialOpen = false, initialCode = '' }) {
  const mine = useMyCoach(user?.uid, profile);
  const [open, setOpen] = useState(initialOpen);
  if (!user) return null;
  const { state, coach, loading } = mine;
  const copy = COPY[state];

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/10 p-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-bold uppercase text-amber-800 dark:text-brand">Meu treinador</p>
          {state === 'active' ? (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/20 text-sm font-bold text-amber-800 dark:text-brand">
                {coach?.photoURL ? <img src={coach.photoURL} alt="" className="h-full w-full object-cover" /> : (coach?.displayName || 'T').charAt(0)}
              </span>
              <div className="min-w-0"><p className="truncate text-sm font-bold text-gray-800 dark:text-white">{coach?.displayName || 'Treinador'}</p><p className="text-xs text-gray-700 dark:text-gray-300">Acompanhando sua evolução</p></div>
            </div>
          ) : (
            <div><p className="text-sm font-bold text-gray-800 dark:text-white">{loading ? 'Carregando...' : copy.title}</p><p className="text-xs text-gray-700 dark:text-gray-300">{copy.text}</p></div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {state === 'active' && (
            <Link to="/chat" className="pressable flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-bold text-amber-800 shadow-sm dark:bg-white/10 dark:text-brand"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Chat</Link>
          )}
          <button type="button" onClick={() => setOpen(true)} className="pressable flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-bold text-gray-800 shadow-sm dark:bg-white/10 dark:text-gray-100">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> {state === 'active' ? 'Gerenciar' : copy.cta}
          </button>
        </div>
      </div>
      {open && <CoachLinkModal user={user} profile={profile} mine={mine} initialCode={initialCode} onClose={() => setOpen(false)} onChanged={onChanged} />}
    </>
  );
}
