import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Megaphone, Copy, Link2, X, Ban } from 'lucide-react';
import Modal from '../common/Modal';
import { btnPrimary, btnGhost, inputCls, labelCls } from './styles';
import { createInvite, listInvites, revokeInvite, inviteStatus } from '../../services/coachLinkService';

const copy = async (text, ok) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch (e) {
    toast.error('Não foi possível copiar.');
  }
};

const STATUS_LABEL = { ok: 'Ativo', revoked: 'Cancelado', expired: 'Expirado', exhausted: 'Esgotado', missing: '-' };
const toDate = (v) => (typeof v?.toDate === 'function' ? v.toDate() : new Date(v));
const linkOf = (id) => `${window.location.origin}/convite/${id}`;

// Convite por link: validade e limite de usos definidos pelo treinador, cancelável. O aluno pede o vínculo e o treinador
// aceita antes de ver qualquer dado dele. O código fixo (UID) continua valendo para quem já o divulgou.
export default function InviteModal({ onClose, coachCode }) {
  const [days, setDays] = useState('7');
  const [maxUses, setMaxUses] = useState('10');
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState(null);

  const load = useCallback(async () => {
    try { setInvites(await listInvites(coachCode)); } catch (error) { console.error(error); setInvites([]); }
  }, [coachCode]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await createInvite(coachCode, { days, maxUses });
      await copy(linkOf(id), 'Convite criado e link copiado!');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error?.code === 'permission-denied' ? 'Sua conta não tem permissão para criar convites.' : 'Não foi possível criar o convite.');
    } finally { setBusy(false); }
  };

  const revoke = async (id) => {
    try { await revokeInvite(id); toast.success('Convite cancelado.'); await load(); }
    catch (error) { console.error(error); toast.error('Não foi possível cancelar o convite.'); }
  };

  return (
    <Modal onClose={onClose} label="Convidar aluno" className="w-full max-w-md">
      <div className="surface relative max-h-[90dvh] overflow-y-auto bg-white p-6 dark:bg-gray-900 animate-scale-in">
        <button type="button" aria-label="Fechar" onClick={onClose} className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/15 text-brand"><Megaphone className="h-8 w-8" /></span>
          <h3 className="font-display text-xl font-black text-gray-900 dark:text-white">Convidar aluno</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Crie um link com validade e limite de usos. O aluno pede o vínculo e você aceita antes de ver qualquer dado dele.</p>
        </div>

        <form onSubmit={create} className="mb-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="inv-days" className={labelCls}>Validade</label>
            <select id="inv-days" value={days} onChange={(e) => setDays(e.target.value)} className={inputCls}>
              <option value="1">1 dia</option><option value="7">7 dias</option><option value="30">30 dias</option>
            </select>
          </div>
          <div>
            <label htmlFor="inv-uses" className={labelCls}>Usos</label>
            <select id="inv-uses" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={inputCls}>
              <option value="1">1 pessoa</option><option value="5">5 pessoas</option><option value="10">10 pessoas</option><option value="50">50 pessoas</option>
            </select>
          </div>
          <button type="submit" disabled={busy} className={`${btnPrimary} sm:col-span-2`}><Link2 className="h-4 w-4" /> {busy ? 'Criando...' : 'Criar link de convite'}</button>
        </form>

        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Seus convites</h4>
        {invites === null && <p className="text-sm text-gray-600 dark:text-gray-400" role="status">Carregando...</p>}
        {invites && invites.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">Nenhum convite ainda.</p>}
        <ul className="space-y-2">
          {(invites || []).slice(0, 10).map((inv) => {
            const status = inviteStatus(inv);
            return (
              <li key={inv.id} className="rounded-2xl bg-gray-100 p-3 text-sm dark:bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${status === 'ok' ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : 'bg-gray-300/60 text-gray-700 dark:bg-white/10 dark:text-gray-300'}`}>{STATUS_LABEL[status]}</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">{inv.uses || 0} de {inv.maxUses} usos · até {toDate(inv.expiresAt).toLocaleDateString('pt-BR')}</span>
                </div>
                {status === 'ok' && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => copy(linkOf(inv.id), 'Link copiado!')} className={`${btnGhost} flex-1`}><Copy className="h-4 w-4" /> Copiar link</button>
                    <button type="button" onClick={() => revoke(inv.id)} className={`${btnGhost} flex-1`}><Ban className="h-4 w-4" /> Cancelar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">Seu código fixo (<code className="select-all break-all font-mono">{coachCode}</code>) também funciona e não expira; prefira os convites acima.</p>
      </div>
    </Modal>
  );
}
