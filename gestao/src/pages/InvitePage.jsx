import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROLE_LABELS, friendlyError } from '../api';
import { useSession } from '../session';
import { Loading, Shell } from './Shell';

// Aceite de convite de equipe (admin, professor, recepção). O código vai no corpo da requisição, nunca na URL da API.
export default function InvitePage() {
  const { code } = useParams();
  const { api } = useSession();
  const [state, setState] = useState({ status: 'loading' });
  const [joined, setJoined] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api.previewInvite(code).then((data) => live && setState({ status: 'ready', data })).catch((error) => live && setState({ status: 'error', error }));
    return () => { live = false; };
  }, [api, code]);
  const accept = async () => {
    setBusy(true);
    try { setJoined(await api.acceptInvite(code)); } catch (error) { setState({ status: 'error', error }); } finally { setBusy(false); }
  };
  return (
    <Shell back={{ to: '/', label: 'Início' }}>
      {state.status === 'loading' && <Loading text="Conferindo o convite..." />}
      {state.status === 'error' && <div role="alert" className="card"><h2>Não foi possível usar este convite</h2><p>{friendlyError(state.error)}</p><Link to="/" className="link">Voltar ao início</Link></div>}
      {state.status === 'ready' && !joined && (
        <div className="card">
          <h2>Convite para {state.data.academyName}</h2>
          <p>Você entrará como <strong>{ROLE_LABELS[state.data.role]}</strong>. Seu nome e vínculo ficam visíveis para a equipe da academia.</p>
          {state.data.role === 'student' && <p className="muted">Alunos treinam no app BohTreinar; aceite o convite de aluno por lá.</p>}
          <button onClick={accept} disabled={busy || state.data.role === 'student'}>{busy ? 'Entrando...' : 'Aceitar convite'}</button>
        </div>
      )}
      {joined && <div className="card" role="status"><h2>Você entrou em {joined.academyName}</h2><Link to={`/academia/${joined.academyId}`} className="link">Abrir a academia</Link></div>}
    </Shell>
  );
}
