import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Copy, LogOut, Link2, Ban } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import PageSkeleton from '../../components/coach/PageSkeleton';
import ErrorState from '../../components/common/ErrorState';
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls, pageCls } from '../../components/coach/styles';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import usePageMeta from '../../hooks/usePageMeta';
import {
  academyInviteStatus, createAcademy, createAcademyInvite, leaveAcademy, listAcademyInvites, listAcademyMembers,
  listMyMemberships, revokeAcademyInvite, ROLE_LABEL, setAdherenceConsent
} from '../../services/academyService';

const STATUS_LABEL = { ok: 'Ativo', revoked: 'Cancelado', expired: 'Expirado', exhausted: 'Esgotado', missing: '-' };
const toDate = (v) => (typeof v?.toDate === 'function' ? v.toDate() : new Date(v));
const linkOf = (id) => `${window.location.origin}/academia/convite/${id}`;
const copy = async (text) => {
  try { await navigator.clipboard.writeText(text); toast.success('Link copiado!'); } catch (e) { toast.error('Não foi possível copiar.'); }
};

function InvitesPanel({ membership, user }) {
  const { academy, role } = membership;
  const [invites, setInvites] = useState(null);
  const [form, setForm] = useState({ role: 'student', days: '7', maxUses: '20' });
  const [busy, setBusy] = useState(false);
  const roles = role === 'owner' ? ['student', 'teacher', 'reception', 'admin'] : ['student', 'teacher', 'reception'];

  const load = useCallback(async () => {
    try { setInvites(await listAcademyInvites(academy.id)); } catch (e) { console.error(e); setInvites([]); }
  }, [academy.id]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await createAcademyInvite(user, academy, { role: form.role, days: Number(form.days), maxUses: Number(form.maxUses) });
      await copy(linkOf(id));
      await load();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível criar o convite. Confira validade (1 a 31 dias) e usos (1 a 200; 1 a 5 para administrador).');
    } finally { setBusy(false); }
  };
  const revoke = async (inv) => {
    try { await revokeAcademyInvite(user, inv); toast.success('Convite cancelado.'); await load(); } catch (e) { console.error(e); toast.error('Não foi possível cancelar.'); }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section aria-label="Convites" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Convites</h3>
      <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-4">
        <div><label htmlFor={`ir-${academy.id}`} className={labelCls}>Papel</label>
          <select id={`ir-${academy.id}`} value={form.role} onChange={set('role')} className={inputCls}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
        <div><label htmlFor={`id-${academy.id}`} className={labelCls}>Validade (dias)</label>
          <input id={`id-${academy.id}`} type="number" min="1" max="31" value={form.days} onChange={set('days')} className={inputCls} /></div>
        <div><label htmlFor={`iu-${academy.id}`} className={labelCls}>Usos</label>
          <input id={`iu-${academy.id}`} type="number" min="1" max="200" value={form.maxUses} onChange={set('maxUses')} className={inputCls} /></div>
        <div className="flex items-end"><button type="submit" disabled={busy} className={`${btnPrimary} w-full`}><Link2 className="h-4 w-4" aria-hidden="true" />{busy ? 'Criando...' : 'Criar convite'}</button></div>
      </form>
      <ul className="mt-3 space-y-2">
        {invites === null && <li className="text-sm text-gray-600 dark:text-gray-400">Carregando...</li>}
        {invites?.length === 0 && <li className="text-sm text-gray-600 dark:text-gray-400">Nenhum convite criado.</li>}
        {invites?.map((inv) => {
          const st = academyInviteStatus(inv);
          return (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm dark:bg-white/5">
              <div><p className="font-bold text-gray-900 dark:text-white">{ROLE_LABEL[inv.role]} · {STATUS_LABEL[st]}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{inv.uses || 0} de {inv.maxUses} usos · até {toDate(inv.expiresAt).toLocaleDateString('pt-BR')}</p></div>
              {st === 'ok' && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => copy(linkOf(inv.id))} className={btnGhost}><Copy className="h-4 w-4" aria-hidden="true" />Copiar</button>
                  <button type="button" onClick={() => revoke(inv)} className={btnDanger}><Ban className="h-4 w-4" aria-hidden="true" />Cancelar</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ConsentCard({ membership, actor, onChanged }) {
  const on = membership.consent?.adherence === true;
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await setAdherenceConsent(actor, membership.academyId, !on);
      toast.success(on ? 'Compartilhamento revogado.' : 'Compartilhamento ativado.');
      await onChanged();
    } catch (e) { console.error(e); toast.error('Não foi possível alterar o consentimento.'); }
    finally { setBusy(false); }
  };
  return (
    <section aria-label="Consentimento de aderência" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Compartilhar aderência com esta academia</h3>
      <p className="mt-1 text-sm font-semibold" role="status">{on ? 'Ativado: você autorizou o compartilhamento.' : 'Desativado: nada é compartilhado.'}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
        <li>Será compartilhado apenas se você está <strong>em dia</strong>, <strong>atrasado</strong> ou <strong>sem dados</strong>.</li>
        <li>Nunca: horários, datas de treino, cargas, medidas, volume ou histórico.</li>
        <li>Vale só para esta academia e você pode revogar quando quiser; ao revogar, o dado de aderência é apagado na hora.</li>
        <li>A exibição individual para a academia só começa quando o sistema de cálculo no servidor estiver ativo; até lá ela não vê nada.</li>
        <li>Seus treinos, medidas e histórico continuam só seus. Sair da academia também encerra este consentimento.</li>
      </ul>
      <button type="button" onClick={toggle} disabled={busy} className={`${on ? btnDanger : btnPrimary} mt-3`}>
        {busy ? 'Salvando...' : on ? 'Revogar compartilhamento' : 'Ativar compartilhamento'}
      </button>
    </section>
  );
}

function MembersList({ academyId }) {
  const [members, setMembers] = useState(null);
  useEffect(() => { listAcademyMembers(academyId).then(setMembers).catch((e) => { console.error(e); setMembers([]); }); }, [academyId]);
  return (
    <section aria-label="Membros" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Membros{members ? ` (${members.length})` : ''}</h3>
      <ul className="mt-3 space-y-1.5">
        {members?.map((m) => (
          <li key={m.userId} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2 text-sm dark:bg-white/5">
            <span className="truncate font-semibold text-gray-900 dark:text-white">{m.displayName || 'Membro'}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{ROLE_LABEL[m.role]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">Dados de aderência não compartilhados pelo aluno. A academia não vê aderência individual, treinos nem medidas nesta versão.</p>
    </section>
  );
}

export default function AcademyPage() {
  usePageMeta('Academia', 'Sua academia no BohTreinar.', { noindex: true });
  const { user, userProfile } = useAuthContext();
  const { confirm, dialog } = useConfirm();
  const [memberships, setMemberships] = useState(null);
  const [error, setError] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const actor = { uid: user?.uid, displayName: userProfile?.displayName || user?.displayName || '' };

  const load = useCallback(async () => {
    try { setError(false); setMemberships(await listMyMemberships(user.uid)); } catch (e) { console.error(e); setError(true); }
  }, [user?.uid]);
  useEffect(() => { if (user?.uid) load(); }, [user?.uid, load]);

  const create = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error('Informe o nome da academia (mínimo 2 letras).'); return; }
    setBusy(true);
    try { await createAcademy(actor, name); setName(''); toast.success('Academia criada.'); await load(); }
    catch (err) { console.error(err); toast.error('Não foi possível criar a academia.'); }
    finally { setBusy(false); }
  };
  const leave = async (m) => {
    if (!(await confirm({ title: `Sair de ${m.academy.name}?`, message: 'Você volta ao modo independente. Seus treinos e histórico continuam seus; a academia perde qualquer acesso.', confirmLabel: 'Sair', danger: true }))) return;
    try { await leaveAcademy(actor, m.academyId); toast.success('Você saiu da academia.'); await load(); }
    catch (err) { console.error(err); toast.error('Não foi possível sair.'); }
  };

  if (error) return <div className={pageCls}><ErrorState onRetry={load} /></div>;
  if (!memberships) return <div className={pageCls}><PageSkeleton /></div>;

  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader eyebrow="Academia" title="Minha academia" subtitle="Participe de uma academia por convite ou crie a sua. Você continua dono dos seus dados." />
        {memberships.length === 0 && (
          <EmptyState icon={Building2} title="Você ainda não está em uma academia" description="Peça o link de convite à sua academia ou crie uma abaixo." />
        )}
        {memberships.map((m) => (
          <article key={m.academyId} className="surface bg-white p-5 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-display text-lg font-black text-gray-900 dark:text-white">{m.academy.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Seu papel: {ROLE_LABEL[m.role]}</p></div>
              {m.role !== 'owner' && <button type="button" onClick={() => leave(m)} className={btnDanger}><LogOut className="h-4 w-4" aria-hidden="true" />Sair da academia</button>}
            </div>
            {m.role === 'student' && <ConsentCard membership={m} actor={actor} onChanged={load} />}
            {['owner', 'admin'].includes(m.role) && <><InvitesPanel membership={m} user={actor} /><MembersList academyId={m.academyId} /></>}
          </article>
        ))}
        <form onSubmit={create} className="surface bg-white p-5 dark:bg-gray-900">
          <h2 className="font-bold text-gray-900 dark:text-white">Criar uma academia</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Você será o proprietário e poderá convidar equipe e alunos. Sua conta atual não muda.</p>
          <label htmlFor="academy-name" className={`${labelCls} mt-3`}>Nome da academia</label>
          <input id="academy-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} autoComplete="organization" />
          <button type="submit" disabled={busy} className={`${btnPrimary} mt-3`}>{busy ? 'Criando...' : 'Criar academia'}</button>
        </form>
        <p className="text-center text-xs text-gray-600 dark:text-gray-400"><Link to="/privacidade" className="underline">Política de privacidade</Link></p>
      </div>
    </div>
  );
}
