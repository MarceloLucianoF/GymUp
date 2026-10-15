import React, { useState } from 'react';
import { INVITE_ROLES } from '../../lib/policy';
import { ROLE_LABELS } from '../../../../shared/academy-contracts/index.js';
import { friendlyError, newIdempotencyKey } from '../../api';
import { ConfirmModal } from '../../components/Modal';
import { useApp } from '../../components/AppFrame';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorState, Field, PageHeader, Pagination, RoleBadge, TableSkeleton } from '../../components/ui';
import { dateTimeOf } from '../../lib/format';
import { useApi } from '../../session';

const STATUS = { active: ['Ativo', 'status-active'], revoked: ['Revogado', 'status-removed'], expired: ['Expirado', 'status-suspended'], exhausted: ['Esgotado', 'status-suspended'] };

function NewInvite({ onCreated }) {
  const { api, academyId, role } = useApp();
  const allowed = INVITE_ROLES[role] || [];
  const [form, setForm] = useState({ role: allowed[allowed.length - 1] || 'student', maxUses: 1, days: 7 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(newIdempotencyKey);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const created = await api.createInvite(academyId, { role: form.role, maxUses: Number(form.maxUses), expiresInDays: Number(form.days) }, attempt);
      setAttempt(newIdempotencyKey());
      onCreated(created);
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form className="panel" onSubmit={submit} aria-labelledby="novo-convite">
      <h2 id="novo-convite">Novo convite</h2>
      <div className="grid3">
        <Field id="inv-role" label="Papel"><select id="inv-role" value={form.role} onChange={set('role')}>{allowed.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
        <Field id="inv-uses" label="Usos" hint="Quantas pessoas podem usar o link."><input id="inv-uses" type="number" min="1" max="500" value={form.maxUses} onChange={set('maxUses')} required /></Field>
        <Field id="inv-days" label="Validade (dias)" hint="De 1 a 30 dias."><input id="inv-days" type="number" min="1" max="30" value={form.days} onChange={set('days')} required /></Field>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Criando...' : 'Criar convite'}</button>
    </form>
  );
}

function OneTimeCode({ invite, onDone }) {
  const toast = useToast();
  const link = `${window.location.origin}/convite/${invite.code}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); toast('Link copiado.'); } catch { toast('Não foi possível copiar. Selecione o link e copie manualmente.', 'error'); }
  };
  return (
    <section className="panel highlight" aria-labelledby="codigo-unico" role="status">
      <h2 id="codigo-unico">Convite criado: copie agora</h2>
      <p>Este link <strong>não será mostrado de novo</strong>. O servidor guarda só uma impressão digital dele, então ninguém consegue recuperá-lo depois.</p>
      <label htmlFor="invite-link" className="visually-hidden">Link do convite</label>
      <input id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} />
      <div className="row-actions">
        <button type="button" className="btn primary" onClick={copy}>{copied ? 'Copiado' : 'Copiar link'}</button>
        <button type="button" className="btn ghost" onClick={onDone}>Já guardei, fechar</button>
      </div>
      <p className="muted small">Papel: {ROLE_LABELS[invite.role]} · {invite.maxUses} {invite.maxUses === 1 ? 'uso' : 'usos'} · vale até {dateTimeOf(invite.expiresAt)}</p>
    </section>
  );
}

export default function Invites() {
  const { api, academyId } = useApp();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [state, reload] = useApi(() => api.invites(academyId, { page, pageSize: 10 }), [api, academyId, page]);
  const [fresh, setFresh] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const doRevoke = async () => {
    setBusy(true); setError('');
    try { await api.revokeInvite(academyId, revoking.inviteId); setRevoking(null); toast('Convite revogado.'); reload(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const d = state.data;
  return (
    <>
      <PageHeader title="Convites" subtitle="Convide professores, recepção, administradores e alunos. O código aparece uma única vez, na criação." />
      <NewInvite onCreated={(c) => { setFresh(c); setPage(1); reload(); }} />
      {fresh && <OneTimeCode invite={fresh} onDone={() => setFresh(null)} />}
      <section aria-labelledby="lista-convites">
        <h2 id="lista-convites">Convites criados</h2>
        {state.status === 'loading' && <TableSkeleton />}
        {state.status === 'error' && <ErrorState error={state.error} onRetry={reload} />}
        {d && d.invites.length === 0 && <EmptyState title="Nenhum convite ainda">Crie o primeiro convite acima para trazer pessoas para a academia.</EmptyState>}
        {d && d.invites.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Convites da academia</caption>
                <thead><tr><th scope="col">Papel</th><th scope="col">Usos</th><th scope="col">Validade</th><th scope="col">Situação</th><th scope="col">Criado por</th><th scope="col"><span className="visually-hidden">Ações</span></th></tr></thead>
                <tbody>
                  {d.invites.map((i) => {
                    const [label, cls] = STATUS[i.status];
                    return (
                      <tr key={i.inviteId}>
                        <td data-label="Papel"><RoleBadge role={i.role} /></td>
                        <td data-label="Usos">{i.uses} de {i.maxUses}</td>
                        <td data-label="Validade">{dateTimeOf(i.expiresAt)}</td>
                        <td data-label="Situação"><span className={`badge ${cls}`}>{label}</span></td>
                        <td data-label="Criado por">{i.createdByName || '-'}</td>
                        <td className="actions">{i.status === 'active' && <button type="button" className="btn ghost danger" onClick={() => { setError(''); setRevoking(i); }}>Revogar</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </section>
      {revoking && (
        <ConfirmModal title="Revogar convite?" confirmLabel="Revogar convite" danger onConfirm={doRevoke} onClose={() => setRevoking(null)} error={error} busy={busy}>
          <p>O link do convite para <strong>{ROLE_LABELS[revoking.role]}</strong> deixa de funcionar na hora. Quem já entrou continua na academia.</p>
        </ConfirmModal>
      )}
    </>
  );
}
