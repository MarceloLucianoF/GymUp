import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROLE_LABELS } from '../../../shared/academy-contracts/index.js';
import { friendlyError } from '../api';
import { Loading } from '../components/ui';
import { dateTimeOf } from '../lib/format';
import { useSession } from '../session';

// Aceite de convite. A prévia NÃO consome o uso: só o botão de confirmação aceita. Qualquer problema dá a mesma mensagem genérica.
export default function InviteAccept() {
  const { code } = useParams();
  const { api, signOut } = useSession();
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
    <main className="center narrow" id="conteudo">
      <div className="panel">
        <p className="brand small">BohTreinar <span>Gestão</span></p>
        {state.status === 'loading' && <Loading text="Conferindo o convite..." />}
        {state.status === 'error' && (
          <>
            <h1>Não foi possível usar este convite</h1>
            <p role="alert">{friendlyError(state.error)}</p>
            <p className="muted">Peça um novo link a quem convidou você.</p>
            <Link to="/app" className="btn">Ir para o início</Link>
          </>
        )}
        {state.status === 'ready' && !joined && (
          <>
            <h1>Convite para {state.data.academyName}</h1>
            <p>Você entrará como <strong>{ROLE_LABELS[state.data.role]}</strong>. A equipe da academia verá seu nome e seu papel.</p>
            <p className="muted small">O convite vale até {dateTimeOf(state.data.expiresAt)}. Nada é gravado até você confirmar.</p>
            <div className="row-actions">
              <button type="button" className="btn primary" onClick={accept} disabled={busy} data-autofocus>{busy ? 'Entrando...' : 'Aceitar convite'}</button>
              <Link to="/app" className="btn ghost">Agora não</Link>
            </div>
            <button type="button" className="link-btn" onClick={signOut}>Entrar com outra conta</button>
          </>
        )}
        {joined && (
          <div role="status">
            <h1>Você entrou em {joined.academyName}</h1>
            {joined.role === 'student' ? <p>Abra o app BohTreinar para ver sua academia, aceitar seu professor e acessar sua ficha.</p> : <Link to="/app" className="btn primary">Abrir a Gestão</Link>}
          </div>
        )}
      </div>
    </main>
  );
}
