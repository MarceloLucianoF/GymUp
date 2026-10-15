import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { MANAGEMENT_ROLES, ROLE_LABELS } from '../../../shared/academy-contracts/index.js';
import { NAV_BY_ROLE } from '../lib/policy';
import { newIdempotencyKey } from '../api';
import { friendlyError } from '../api';
import { useApi, useSession } from '../session';
import { useToast } from './Toast';
import Modal from './Modal';
import { ErrorState, Field, Loading } from './ui';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
const STORE = 'gestao:academy';
const read = () => { try { return localStorage.getItem(STORE); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(STORE, v); } catch { /* sem armazenamento: segue sem lembrar */ } };

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  membros: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0v1H4v-1z',
  convites: 'M3 5h18v14H3V5zm2 2v.5l7 5 7-5V7H5z',
  auditoria: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z',
  academia: 'M12 3l9 6v12H3V9l9-6zm-2 10v6h4v-6h-4z',
  alunos: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0H4z'
};
const LABELS = { dashboard: 'Início', membros: 'Membros', convites: 'Convites', auditoria: 'Auditoria', academia: 'Academia', alunos: 'Meus alunos' };
const Icon = ({ name }) => <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ICONS[name]} fill="currentColor" /></svg>;

function CreateAcademyModal({ onClose, onCreated }) {
  const { api } = useSession();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(newIdempotencyKey);   // a mesma chave vale até dar certo: repetir o envio não duplica
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { const created = await api.createAcademy(name.trim(), attempt); setAttempt(newIdempotencyKey()); onCreated(created); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Criar academia" onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="stack">
        <Field id="new-academy" label="Nome da academia" hint="Você será o proprietário. Convide a equipe depois.">
          <input id="new-academy" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required data-autofocus aria-describedby="new-academy-hint" autoComplete="organization" />
        </Field>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy || name.trim().length < 2}>{busy ? 'Criando...' : 'Criar academia'}</button>
        </div>
      </form>
    </Modal>
  );
}

// Moldura do app: carrega as academias do usuário, escolhe a atual e monta o menu conforme o papel.
export default function AppFrame() {
  const { api, user, signOut } = useSession();
  const navigate = useNavigate();
  const routeMatch = useMatch('/app/academia/:academyId/*');
  const toast = useToast();
  const [me, reloadMe] = useApi(() => api.me(), [api]);
  const [creating, setCreating] = useState(false);
  const [stored, setStored] = useState(read);

  const academies = useMemo(
    () => (me.data?.memberships || []).filter((m) => MANAGEMENT_ROLES.includes(m.role) && m.status === 'active' && m.academy?.status === 'active'),
    [me.data]
  );
  const routeId = routeMatch?.params.academyId;
  const current = academies.find((a) => a.academyId === routeId) || academies.find((a) => a.academyId === stored) || academies[0] || null;
  useEffect(() => { if (current && current.academyId !== stored) { write(current.academyId); setStored(current.academyId); } }, [current, stored]);

  const select = useCallback((id) => { write(id); setStored(id); navigate('/app'); }, [navigate]);
  const onCreated = useCallback((created) => {
    setCreating(false);
    toast(`Academia "${created.name}" criada.`);
    write(created.academyId); setStored(created.academyId);
    reloadMe();
    navigate('/app');
  }, [toast, reloadMe, navigate]);

  const ctx = useMemo(() => ({ api, user, academies, current, academyId: current?.academyId, role: current?.role, select, reloadMe, openCreate: () => setCreating(true) }), [api, user, academies, current, select, reloadMe]);

  if (me.status === 'loading') return <div className="center"><Loading text="Carregando suas academias..." /></div>;
  if (me.status === 'error') return <div className="center"><ErrorState error={me.error} onRetry={reloadMe} /></div>;

  const nav = current ? NAV_BY_ROLE[current.role] || [] : [];
  const base = current ? `/app/academia/${current.academyId}` : '/app';
  const to = (item) => (item === 'dashboard' ? '/app' : `${base}${item === 'academia' ? '' : `/${item}`}`);
  const studentOnly = me.data.memberships.some((m) => m.role === 'student' && m.status === 'active') && academies.length === 0;

  return (
    <AppCtx.Provider value={ctx}>
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>
      <div className="frame">
        <aside className="sidebar" aria-label="Menu principal">
          <Link to="/app" className="brand">BohTreinar <span>Gestão</span></Link>
          {academies.length > 0 && (
            <div className="switcher">
              <label htmlFor="academy-select">Academia</label>
              <select id="academy-select" value={current?.academyId || ''} onChange={(e) => select(e.target.value)}>
                {academies.map((a) => <option key={a.academyId} value={a.academyId}>{a.academy.name}</option>)}
              </select>
              {current && <p className="muted small">Seu papel: {ROLE_LABELS[current.role]}</p>}
            </div>
          )}
          <nav className="nav" aria-label="Seções">
            {nav.map((item) => (
              <NavLink key={item} to={to(item)} end={item === 'dashboard' || item === 'academia'} className={({ isActive }) => (isActive ? 'nav-link on' : 'nav-link')}>
                <Icon name={item} /><span>{LABELS[item]}</span>
              </NavLink>
            ))}
          </nav>
          <div className="side-foot">
            <button type="button" className="btn ghost block" onClick={() => setCreating(true)}>Nova academia</button>
            <button type="button" className="btn ghost block" onClick={signOut}>Sair</button>
          </div>
        </aside>
        <header className="topbar">
          <Link to="/app" className="brand">BohTreinar <span>Gestão</span></Link>
          {academies.length > 1 && (
            <select aria-label="Trocar de academia" value={current?.academyId || ''} onChange={(e) => select(e.target.value)}>
              {academies.map((a) => <option key={a.academyId} value={a.academyId}>{a.academy.name}</option>)}
            </select>
          )}
          <button type="button" className="btn ghost" onClick={signOut}>Sair</button>
        </header>
        <main id="conteudo" className="content" tabIndex={-1}>
          {current ? <Outlet context={ctx} /> : (
            <div className="empty big">
              <h1>{studentOnly ? 'Você é aluno nesta conta' : 'Nenhuma academia para gerir'}</h1>
              <p className="muted">{studentOnly ? 'Alunos treinam no app BohTreinar. Esta área é para proprietários, administradores, professores e recepção.' : 'Crie a sua academia ou abra o link de um convite recebido. Alunos treinam no app BohTreinar.'}</p>
              <button type="button" className="btn primary" onClick={() => setCreating(true)}>Criar academia</button>
            </div>
          )}
        </main>
        {current && nav.length > 0 && (
          <nav className="bottomnav" aria-label="Seções (celular)">
            {nav.slice(0, 5).map((item) => (
              <NavLink key={item} to={to(item)} end={item === 'dashboard' || item === 'academia'} className={({ isActive }) => (isActive ? 'bn on' : 'bn')}>
                <Icon name={item} /><span>{LABELS[item]}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
      {creating && <CreateAcademyModal onClose={() => setCreating(false)} onCreated={onCreated} />}
    </AppCtx.Provider>
  );
}
