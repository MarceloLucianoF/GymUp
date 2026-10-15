import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LIMITS, ROLE_LABELS } from '../../../../shared/academy-contracts/index.js';
import { friendlyError, newIdempotencyKey } from '../../api';
import { useApp } from '../../components/AppFrame';
import Modal, { ConfirmModal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ErrorState, Field, Loading, PageHeader, RoleBadge } from '../../components/ui';
import { dateOf } from '../../lib/format';
import { useApi } from '../../session';

function TransferModal({ academy, onClose, onDone }) {
  const { api, academyId } = useApp();
  const [admins, setAdmins] = useState(null);
  const [toUid, setToUid] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt] = useState(newIdempotencyKey);
  useEffect(() => {
    let live = true;
    Promise.all(['admin', 'coach', 'reception'].map((r) => api.members(academyId, { role: r, status: 'active', pageSize: 50 })))
      .then((all) => { if (!live) return; const list = all.flatMap((a) => a.members); setAdmins(list); setToUid(list[0]?.userId || ''); })
      .catch((e) => live && setError(friendlyError(e)));
    return () => { live = false; };
  }, [api, academyId]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.transferOwnership(academyId, toUid, attempt); onDone(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  const ok = typed.trim() === academy.name && toUid;
  return (
    <Modal title="Transferir propriedade" onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="stack">
        <p>A pessoa escolhida passa a ser <strong>proprietária</strong> e você vira <strong>administrador</strong>. Isso muda quem controla a academia e fica registrado na auditoria.</p>
        {admins === null && !error && <Loading />}
        {admins && admins.length === 0 && <p className="error" role="alert">Não há administrador, professor ou recepção ativos para receber a propriedade. Convide alguém primeiro.</p>}
        {admins && admins.length > 0 && (
          <>
            <Field id="to-owner" label="Novo proprietário"><select id="to-owner" value={toUid} onChange={(e) => setToUid(e.target.value)} data-autofocus>{admins.map((m) => <option key={m.userId} value={m.userId}>{m.displayName} ({ROLE_LABELS[m.role]})</option>)}</select></Field>
            <Field id="type-name" label={`Para confirmar, digite o nome da academia: ${academy.name}`}><input id="type-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
          </>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn danger-fill" disabled={busy || !ok}>{busy ? 'Transferindo...' : 'Transferir propriedade'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AcademyPage() {
  const { api, academyId, role, reloadMe } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [state, reload] = useApi(() => api.profile(academyId), [api, academyId]);
  const canEdit = ['owner', 'admin'].includes(role);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [transfer, setTransfer] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const p = state.data;
  useEffect(() => { if (p) setForm({ name: p.name, description: p.description, contactEmail: p.contactEmail }); }, [p]);

  const dirty = p && form && (form.name !== p.name || form.description !== p.description || form.contactEmail !== p.contactEmail);
  const save = async (e) => {
    e.preventDefault();
    const body = {};
    if (role === 'owner' && form.name !== p.name) body.name = form.name.trim();
    if (form.description !== p.description) body.description = form.description;
    if (form.contactEmail !== p.contactEmail) body.contactEmail = form.contactEmail.trim();
    setSaving(true); setError('');
    try { await api.updateAcademy(academyId, body); toast('Dados da academia atualizados.'); reload(); reloadMe(); } catch (err) { setError(friendlyError(err)); } finally { setSaving(false); }
  };
  const leave = async () => {
    setBusy(true); setLeaveError('');
    try { await api.leave(academyId); toast('Você saiu da academia.'); reloadMe(); navigate('/app', { replace: true }); } catch (err) { setLeaveError(friendlyError(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Academia" subtitle="Dados básicos, seu papel e ações administrativas." />
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={reload} />}
      {p && form && (
        <>
          <section className="panel" aria-labelledby="dados">
            <h2 id="dados">Dados básicos</h2>
            <dl className="facts">
              <div><dt>Status</dt><dd><span className="badge status-active">{p.status === 'active' ? 'Ativa' : 'Suspensa'}</span></dd></div>
              <div><dt>Seu papel</dt><dd><RoleBadge role={p.myRole} /></dd></div>
              <div><dt>Criada em</dt><dd>{dateOf(p.createdAt)}</dd></div>
            </dl>
            <form onSubmit={save} className="stack">
              <Field id="a-name" label="Nome" hint={role !== 'owner' ? 'Só o proprietário altera o nome.' : undefined}>
                <input id="a-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={role !== 'owner'} minLength={LIMITS.academyName[0]} maxLength={LIMITS.academyName[1]} required />
              </Field>
              <Field id="a-desc" label="Descrição" hint="Aparece para os membros. Até 500 caracteres.">
                <textarea id="a-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canEdit} maxLength={LIMITS.description} rows={3} />
              </Field>
              <Field id="a-contact" label="E-mail de contato da academia" hint="Opcional. É o contato da empresa, não de uma pessoa. Telefone e CPF não são coletados.">
                <input id="a-contact" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} disabled={!canEdit} maxLength={LIMITS.contactEmail} autoComplete="off" />
              </Field>
              {error && <p role="alert" className="error">{error}</p>}
              {canEdit && <div><button type="submit" className="btn primary" disabled={saving || !dirty}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></div>}
            </form>
          </section>
          <section className="panel" aria-labelledby="acoes">
            <h2 id="acoes">Ações administrativas</h2>
            {role === 'owner' ? (
              <div className="stack">
                <p className="muted">Para sair da academia, transfira a propriedade antes: ela nunca fica sem proprietário.</p>
                <div><button type="button" className="btn danger" onClick={() => setTransfer(true)}>Transferir propriedade</button></div>
              </div>
            ) : (
              <div className="stack">
                <p className="muted">Ao sair, seu vínculo e os vínculos com alunos são encerrados. Você pode voltar com um novo convite.</p>
                <div><button type="button" className="btn danger" onClick={() => { setLeaveError(''); setLeaving(true); }}>Sair da academia</button></div>
              </div>
            )}
            <p className="muted small">Configurações de planos e mensalidades: <span className="soon">Em breve</span></p>
          </section>
        </>
      )}
      {transfer && p && <TransferModal academy={p} onClose={() => setTransfer(false)} onDone={() => { setTransfer(false); toast('Propriedade transferida. Você agora é administrador.'); reloadMe(); reload(); }} />}
      {leaving && <ConfirmModal title="Sair da academia?" confirmLabel="Sair da academia" danger busy={busy} error={leaveError} onConfirm={leave} onClose={() => setLeaving(false)}><p>Você perde o acesso a esta academia e os vínculos com alunos são encerrados.</p></ConfirmModal>}
    </>
  );
}
