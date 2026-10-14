import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ACTION_LABELS, ROLE_LABELS, STATUS_LABELS, friendlyError } from '../api';
import { INVITE_ROLES, memberActions } from '../policy';
import { useApi, useSession } from '../session';
import { ErrorBox, Loading, Shell } from './Shell';

// Detalhe da auditoria em português: "teacher,suspended" vira "Professor, Suspenso"; convite traz só o papel.
const detailText = (action, detail) => {
  if (!detail) return '';
  if (action === 'invite.created') return ROLE_LABELS[detail] || detail;
  if (action.startsWith('member.')) return detail.split(',').map((p) => ROLE_LABELS[p] || STATUS_LABELS[p] || p).join(', ');
  return detail;
};
const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function MembersTab({ academyId, me, members, reload }) {
  const { api } = useSession();
  const [pending, setPending] = useState(null);   // { userId, change, label }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const apply = async () => {
    setBusy(true); setError('');
    try { await api.updateMember(academyId, pending.userId, pending.change); setPending(null); reload(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  return (
    <section aria-label="Membros">
      {error && <p role="alert" className="error">{error}</p>}
      <ul className="rows">
        {members.map((m) => {
          const act = memberActions(me, m);
          const asking = pending?.userId === m.userId;
          return (
            <li key={m.userId} className="row">
              <div className="row-main">
                <strong>{m.displayName || 'Sem nome'}</strong>
                <span className="muted">{ROLE_LABELS[m.role]}</span>
                <span className={`badge badge-${m.status}`}>{STATUS_LABELS[m.status]}</span>
              </div>
              {asking ? (
                <div className="row-actions" role="group" aria-label={`Confirmar: ${pending.label}`}>
                  <span>{pending.label}?</span>
                  <button onClick={apply} disabled={busy}>{busy ? 'Aplicando...' : 'Confirmar'}</button>
                  <button className="ghost" onClick={() => setPending(null)} disabled={busy}>Cancelar</button>
                </div>
              ) : (
                <div className="row-actions">
                  {act.suspend && <button className="ghost" onClick={() => setPending({ userId: m.userId, change: { status: 'suspended' }, label: `Suspender ${m.displayName || 'membro'}` })}>Suspender</button>}
                  {act.reactivate && <button className="ghost" onClick={() => setPending({ userId: m.userId, change: { status: 'active' }, label: `Reativar ${m.displayName || 'membro'}` })}>Reativar</button>}
                  {act.remove && <button className="ghost danger" onClick={() => setPending({ userId: m.userId, change: { status: 'removed' }, label: `Remover ${m.displayName || 'membro'}` })}>Remover</button>}
                  {act.roles.length > 0 && (
                    <select aria-label={`Alterar papel de ${m.displayName || 'membro'}`} value="" onChange={(e) => e.target.value && setPending({ userId: m.userId, change: { role: e.target.value }, label: `Mudar ${m.displayName || 'membro'} para ${ROLE_LABELS[e.target.value]}` })}>
                      <option value="">Alterar papel</option>
                      {act.roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function inviteState(i, now = Date.now()) {
  if (i.revoked) return 'Revogado';
  if (new Date(i.expiresAt).getTime() <= now) return 'Expirado';
  if (i.uses >= i.maxUses) return 'Esgotado';
  return 'Ativo';
}

function InvitesTab({ academyId, myRole }) {
  const { api } = useSession();
  const allowed = INVITE_ROLES[myRole] || [];
  const [state, reload] = useApi(() => api.invites(academyId), [api, academyId]);
  const [role, setRole] = useState(allowed[allowed.length - 1] || 'student');
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState(null);
  const [copied, setCopied] = useState(false);
  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setCopied(false);
    try { setFresh(await api.createInvite(academyId, { role, maxUses: Number(maxUses), expiresInDays: Number(days) })); reload(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  const revoke = async (id) => {
    setError('');
    try { await api.revokeInvite(academyId, id); reload(); } catch (err) { setError(friendlyError(err)); }
  };
  const link = fresh ? `${window.location.origin}/convite/${fresh.code}` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } };
  return (
    <section aria-label="Convites">
      <form className="card wide" onSubmit={create}>
        <h2>Novo convite</h2>
        <div className="grid3">
          <div><label htmlFor="inv-role">Papel</label>
            <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value)}>{allowed.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
          <div><label htmlFor="inv-uses">Usos</label><input id="inv-uses" type="number" min="1" max="500" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} required /></div>
          <div><label htmlFor="inv-days">Validade (dias)</label><input id="inv-days" type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} required /></div>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Criando...' : 'Criar convite'}</button>
      </form>
      {fresh && (
        <div className="card wide" role="status">
          <h2>Convite criado</h2>
          <p>Copie agora: este link <strong>não será mostrado de novo</strong>. Só o servidor guarda uma impressão digital dele.</p>
          <input readOnly value={link} aria-label="Link do convite" onFocus={(e) => e.target.select()} />
          <button onClick={copy}>{copied ? 'Copiado' : 'Copiar link'}</button>
        </div>
      )}
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
      {state.status === 'ready' && (
        state.data.invites.length === 0 ? <p className="muted">Nenhum convite ainda.</p> : (
          <ul className="rows" aria-label="Convites criados">
            {state.data.invites.map((i) => {
              const st = inviteState(i);
              return (
                <li key={i.inviteId} className="row">
                  <div className="row-main">
                    <strong>{ROLE_LABELS[i.role]}</strong>
                    <span className="muted">{i.uses} de {i.maxUses} usos · vence {fmt(i.expiresAt)}</span>
                    <span className={`badge badge-${st === 'Ativo' ? 'active' : 'removed'}`}>{st}</span>
                  </div>
                  {st === 'Ativo' && <div className="row-actions"><button className="ghost danger" onClick={() => revoke(i.inviteId)}>Revogar</button></div>}
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}

function AuditTab({ academyId, names }) {
  const { api } = useSession();
  const [state, reload] = useApi(() => api.audit(academyId), [api, academyId]);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorBox error={state.error} onRetry={reload} />;
  const who = (id) => names.get(id) || 'Usuário';
  return (
    <section aria-label="Auditoria">
      <ul className="rows">
        {state.data.entries.map((e) => (
          <li key={e.id} className="row">
            <div className="row-main">
              <strong>{ACTION_LABELS[e.action] || e.action}</strong>
              <span className="muted">por {who(e.actorId)}{e.targetType === 'member' && e.targetId !== e.actorId ? ` · alvo ${who(e.targetId)}` : ''}{e.detail ? ` · ${detailText(e.action, e.detail)}` : ''}</span>
            </div>
            <time className="muted" dateTime={e.at}>{fmt(e.at)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AcademyPage() {
  const { academyId } = useParams();
  const { api, user } = useSession();
  const [info, reloadInfo] = useApi(() => api.academy(academyId), [api, academyId]);
  const isStaff = ['owner', 'admin'].includes(info.data?.myRole);
  const canInvite = !!INVITE_ROLES[info.data?.myRole];
  const [members, reloadMembers] = useApi(() => (isStaff ? api.members(academyId) : Promise.resolve({ members: [] })), [api, academyId, isStaff, info.status]);
  const [tab, setTab] = useState('members');
  const names = useMemo(() => new Map((members.data?.members || []).map((m) => [m.userId, m.displayName || 'Sem nome'])), [members.data]);
  const tabs = [isStaff && ['members', 'Membros'], canInvite && ['invites', 'Convites'], isStaff && ['audit', 'Auditoria']].filter(Boolean);
  const current = tabs.find(([id]) => id === tab) ? tab : tabs[0]?.[0];
  return (
    <Shell back={{ to: '/', label: 'Academias' }}>
      {info.status === 'loading' && <Loading />}
      {info.status === 'error' && <ErrorBox error={info.error} onRetry={reloadInfo} />}
      {info.status === 'ready' && (
        <>
          <h1 className="title">{info.data.name}</h1>
          <p className="muted">Seu papel: {ROLE_LABELS[info.data.myRole]}</p>
          {tabs.length === 0 && <div className="card"><p>As ferramentas do seu papel (alunos, fichas) chegam nas próximas versões.</p></div>}
          {tabs.length > 0 && (
            <div role="tablist" aria-label="Seções da academia" className="tabs">
              {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={current === id} className={current === id ? 'tab on' : 'tab'} onClick={() => { setTab(id); if (id === 'members') reloadMembers(); }}>{label}</button>)}   {/* ao voltar para Membros, busca de novo: outra pessoa pode ter entrado */}
            </div>
          )}
          {current === 'members' && (members.status === 'loading' ? <Loading /> : members.status === 'error' ? <ErrorBox error={members.error} onRetry={reloadMembers} /> : <MembersTab academyId={academyId} me={{ userId: user.uid, role: info.data.myRole }} members={members.data.members} reload={reloadMembers} />)}
          {current === 'invites' && <InvitesTab academyId={academyId} myRole={info.data.myRole} />}
          {current === 'audit' && <AuditTab academyId={academyId} names={names} />}
        </>
      )}
    </Shell>
  );
}
