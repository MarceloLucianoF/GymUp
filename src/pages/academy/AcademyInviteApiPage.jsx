import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';
import { btnPrimary, pageCls } from '../../components/coach/styles';
import { useAuthContext } from '../../hooks/AuthContext';
import usePageMeta from '../../hooks/usePageMeta';
import { academyApi, academyApiMessage } from '../../services/academyApi';

const ROLE = { admin: 'Administrador', coach: 'Professor', reception: 'Recepção', student: 'Aluno' };

// /academia/convite/<código>: mostra a academia e o papel SEM consumir o convite; só entra depois do clique. Todo problema dá a mesma mensagem.
export default function AcademyInviteApiPage() {
  usePageMeta('Convite de academia', 'Entrar em uma academia por convite.', { noindex: true });
  const { id: code } = useParams();
  const { user, authLoading } = useAuthContext();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return undefined;
    let live = true;
    academyApi.previewInvite(code).then((data) => live && setState({ status: 'ready', data })).catch((error) => live && setState({ status: 'error', error }));
    return () => { live = false; };
  }, [code, user, authLoading]);

  const join = async () => {
    setBusy(true);
    try {
      const joined = await academyApi.acceptInvite(code);
      if (joined.role === 'student' && consent) await academyApi.setConsent(joined.academyId, true).catch(() => toast.error('Você entrou, mas não foi possível registrar o consentimento. Ative-o em Minha academia.'));
      toast.success(`Você entrou em ${joined.academyName}.`);
      navigate('/academia', { replace: true });
    } catch (e) { console.error(e); setState({ status: 'error', error: e }); } finally { setBusy(false); }
  };

  return (
    <div className={pageCls}>
      <div className="mx-auto max-w-md">
        <div className="surface bg-white p-6 text-center dark:bg-gray-900">
          <span className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/15 text-brand"><Building2 className="h-8 w-8" aria-hidden="true" /></span>
          <h1 className="font-display text-xl font-black text-gray-900 dark:text-white">Convite de academia</h1>
          {authLoading && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Carregando...</p>}
          {!authLoading && !user && (
            <div className="mt-5 flex flex-col gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Entre ou crie sua conta e abra este link de novo.</p>
              <Link to="/login" className={btnPrimary}>Entrar</Link>
              <Link to="/register" className="text-sm font-bold text-brand underline">Criar conta</Link>
            </div>
          )}
          {user && state.status === 'loading' && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Conferindo o convite...</p>}
          {user && state.status === 'error' && <p role="alert" className="mt-3 text-sm text-gray-700 dark:text-gray-300">{academyApiMessage(state.error)}</p>}
          {user && state.status === 'ready' && (
            <>
              <p className="mt-3 text-gray-700 dark:text-gray-300"><strong>{state.data.academyName}</strong> convida você como <strong>{ROLE[state.data.role]}</strong>.</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Entrar não muda sua conta nem dá acesso da academia aos seus treinos, medidas ou histórico. Nada é gravado até você confirmar, e você pode sair quando quiser.</p>
              {state.data.role === 'student' && (
                <label className="mt-4 flex items-start gap-3 rounded-2xl bg-gray-50 p-3 text-left text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5" />
                  <span>Autorizo registrar que aceito compartilhar com esta academia se estou em dia, atrasado ou sem dados (nunca horários, cargas ou medidas). A exibição individual ainda não existe; posso revogar quando quiser.</span>
                </label>
              )}
              <button type="button" onClick={join} disabled={busy} className={`${btnPrimary} mt-5 w-full`}>{busy ? 'Entrando...' : 'Entrar na academia'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
