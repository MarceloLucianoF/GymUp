import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';
import { btnPrimary, pageCls } from '../../components/coach/styles';
import { useAuthContext } from '../../hooks/AuthContext';
import usePageMeta from '../../hooks/usePageMeta';
import { academyInviteStatus, getAcademyInviteInfo, joinAcademy, ROLE_LABEL } from '../../services/academyService';

const MESSAGES = {
  missing: 'Este convite não existe ou o link está incompleto.',
  revoked: 'Este convite foi cancelado pela academia.',
  expired: 'Este convite expirou. Peça um novo à academia.',
  error: 'Não foi possível carregar o convite. Verifique a conexão e tente de novo.',
  exhausted: 'Este convite já atingiu o limite de usos. Peça um novo à academia.'
};

// /academia/convite/<id>: mostra a academia e o papel, e só entra depois do clique. A aderência só é compartilhada se o aluno marcar.
export default function AcademyInvitePage() {
  usePageMeta('Convite de academia', 'Entrar em uma academia por convite.', { noindex: true });
  const { id } = useParams();
  const { user, userProfile, authLoading } = useAuthContext();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(undefined);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getAcademyInviteInfo(id).then(setInvite).catch((e) => { console.error(e); setInvite('error'); }); }, [id]);

  const join = async () => {
    setBusy(true);
    try {
      await joinAcademy({ uid: user.uid, displayName: userProfile?.displayName || user.displayName || '' }, invite, { adherenceConsent: invite.role === 'student' && consent });
      toast.success(`Você entrou em ${invite.academyName}.`);
      navigate('/academia', { replace: true });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível entrar. O convite pode ter sido cancelado ou esgotado.');
    } finally { setBusy(false); }
  };

  const status = invite === undefined ? 'loading' : invite === 'error' ? 'error' : academyInviteStatus(invite);
  return (
    <div className={pageCls}>
      <div className="mx-auto max-w-md">
        <div className="surface bg-white p-6 text-center dark:bg-gray-900">
          <span className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/15 text-brand"><Building2 className="h-8 w-8" aria-hidden="true" /></span>
          <h1 className="font-display text-xl font-black text-gray-900 dark:text-white">Convite de academia</h1>
          {(status === 'loading' || authLoading) && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Carregando...</p>}
          {status !== 'loading' && status !== 'ok' && <p role="alert" className="mt-3 text-sm text-gray-700 dark:text-gray-300">{MESSAGES[status]}</p>}
          {status === 'ok' && !authLoading && (
            <>
              <p className="mt-3 text-gray-700 dark:text-gray-300"><strong>{invite.academyName}</strong> convida você como <strong>{ROLE_LABEL[invite.role]}</strong>.</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Entrar não muda sua conta nem dá acesso da academia aos seus treinos, medidas ou histórico. Você pode sair quando quiser.</p>
              {!user ? (
                <div className="mt-5 flex flex-col gap-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Entre ou crie sua conta e abra este link de novo.</p>
                  <Link to="/login" className={btnPrimary}>Entrar</Link>
                  <Link to="/register" className="text-sm font-bold text-brand underline">Criar conta</Link>
                </div>
              ) : (
                <>
                  {invite.role === 'student' && (
                    <label className="mt-4 flex items-start gap-3 rounded-2xl bg-gray-50 p-3 text-left text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5" />
                      <span>Autorizo compartilhar com esta academia se estou em dia, atrasado ou sem dados (nunca horários, cargas ou medidas). A exibição individual só começa quando o cálculo no servidor estiver ativo; até lá ninguém da academia vê. Posso revogar quando quiser.</span>
                    </label>
                  )}
                  <button type="button" onClick={join} disabled={busy} className={`${btnPrimary} mt-5 w-full`}>{busy ? 'Entrando...' : 'Entrar na academia'}</button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
