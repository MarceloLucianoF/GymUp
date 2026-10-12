import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MessageSquare, Search, UserCheck, UserX, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { btnGhost, btnPrimary, inputCls } from './styles';
import { useConfirm } from '../../hooks/useConfirm';
import { cancelRequest, endMyLink, filterCoaches, listPublicCoaches, requestCoach } from '../../services/coachLinkService';

const Avatar = ({ coach }) => (
  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/20 font-black text-amber-800 dark:text-brand">
    {coach?.photoURL ? <img src={coach.photoURL} alt="" className="h-full w-full object-cover" /> : (coach?.displayName || 'T').charAt(0)}
  </span>
);

const NOTICE = {
  rejected: 'Sua última solicitação foi recusada. Você pode procurar outro treinador.',
  revoked: 'O vínculo anterior foi encerrado. Seus treinos e medidas continuam com você.'
};

// "Meu treinador": estado atual + encontrar por nome ou usar código/convite + cancelar/encerrar.
export default function CoachLinkModal({ user, profile, mine, initialCode = '', onClose, onChanged }) {
  const { confirm, dialog } = useConfirm();
  const { state, coach, reload } = mine;
  const [tab, setTab] = useState(initialCode ? 'code' : 'find');
  const [code, setCode] = useState(initialCode);
  const [term, setTerm] = useState('');
  const [coaches, setCoaches] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!['none', 'rejected', 'revoked'].includes(state) || coaches) return;
    listPublicCoaches().then(setCoaches).catch(() => setCoaches([]));
  }, [state, coaches]);

  const visible = useMemo(() => filterCoaches(coaches || [], term), [coaches, term]);

  const done = async (message) => { if (message) toast.success(message); await reload(); onChanged?.(); };

  const request = async (value) => {
    setBusy(true);
    try {
      const r = await requestCoach({ uid: user.uid, displayName: profile?.displayName || user.displayName }, value);
      await done(`Solicitação enviada para ${r.coachName}. Aguarde a confirmação.`);
    } catch (error) {
      toast.error(error.message || 'Não foi possível enviar a solicitação.');
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true);
    try { await cancelRequest(user.uid); await done('Solicitação cancelada.'); }
    catch (error) { console.error(error); toast.error('Não foi possível cancelar.'); }
    finally { setBusy(false); }
  };

  const endLink = async () => {
    const ok = await confirm({
      title: 'Encerrar vínculo?',
      message: `${coach?.displayName || 'O treinador'} deixa de ver seus treinos e medidas novos. Fichas já atribuídas continuam disponíveis e seu histórico não é apagado.`,
      confirmLabel: 'Encerrar vínculo', danger: true
    });
    if (!ok) return;
    setBusy(true);
    try { await endMyLink(user.uid); await done('Vínculo encerrado.'); }
    catch (error) { console.error(error); toast.error('Não foi possível encerrar.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} label="Meu treinador" className="w-full max-w-md">
      {dialog}
      <div className="max-h-[88dvh] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#141A29] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-black text-gray-900 dark:text-white">Meu treinador</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="pressable flex h-11 w-11 items-center justify-center rounded-2xl text-gray-700 dark:text-gray-300"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        {state === 'active' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-brand/10 p-4">
              <Avatar coach={coach} />
              <div className="min-w-0"><p className="truncate font-bold text-gray-900 dark:text-white">{coach?.displayName || 'Treinador'}</p><p className="flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300"><UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> Vínculo ativo</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/chat" onClick={onClose} className={btnPrimary}><MessageSquare className="h-4 w-4" aria-hidden="true" /> Abrir chat</Link>
              <button type="button" onClick={endLink} disabled={busy} className={btnGhost}><UserX className="h-4 w-4" aria-hidden="true" /> Encerrar vínculo</button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Para trocar de treinador, encerre o vínculo e peça um novo.</p>
          </div>
        )}

        {state === 'pending' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-4">
              <Avatar coach={coach} />
              <div className="min-w-0"><p className="truncate font-bold text-gray-900 dark:text-white">{coach?.displayName || 'Treinador'}</p><p className="flex items-center gap-1 text-xs font-semibold text-amber-900 dark:text-amber-200"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> Aguardando confirmação</p></div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">O treinador ainda precisa aceitar. Enquanto isso ele não vê nenhum dado seu.</p>
            <button type="button" onClick={cancel} disabled={busy} className={btnGhost}>Cancelar solicitação</button>
          </div>
        )}

        {['none', 'rejected', 'revoked'].includes(state) && (
          <div className="space-y-4">
            {NOTICE[state] && <p role="status" className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">{NOTICE[state]}</p>}
            <p className="text-sm text-gray-700 dark:text-gray-300">O treinador só vê seus dados depois que aceitar o seu pedido.</p>
            <div role="tablist" aria-label="Como encontrar" className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/5">
              {[['find', 'Encontrar treinador'], ['code', 'Tenho um código']].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={`min-h-[44px] rounded-xl px-2 text-sm font-bold ${tab === id ? 'bg-gradient-to-r from-brand to-[#FF9800] text-black' : 'text-gray-700 dark:text-gray-300'}`}>{label}</button>
              ))}
            </div>

            {tab === 'find' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                  <input type="search" aria-label="Buscar treinador pelo nome" placeholder="Nome do treinador" value={term} onChange={(e) => setTerm(e.target.value)} className={`${inputCls} !pl-11`} />
                </div>
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {coaches === null && <li className="p-3 text-sm text-gray-600 dark:text-gray-400">Carregando...</li>}
                  {coaches && visible.length === 0 && <li className="p-3 text-sm text-gray-600 dark:text-gray-400">Nenhum treinador encontrado. Se ele passou um código, use a outra aba.</li>}
                  {visible.map((c) => (
                    <li key={c.uid} className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3 dark:border-white/10">
                      <Avatar coach={c} />
                      <div className="min-w-0 flex-1"><p className="truncate font-bold text-gray-900 dark:text-white">{c.displayName}</p>{c.bio && <p className="line-clamp-1 text-xs text-gray-600 dark:text-gray-400">{c.bio}</p>}</div>
                      <button type="button" disabled={busy} onClick={() => request(c.uid)} className="pressable min-h-[44px] rounded-xl bg-gradient-to-r from-brand to-[#FF9800] px-3 text-xs font-black text-black disabled:opacity-50">Pedir vínculo</button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); request(code); }}>
                <label htmlFor="coach-code" className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Código ou link do convite</label>
                <input id="coach-code" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} font-mono`} placeholder="Cole o código ou o link" autoCapitalize="none" spellCheck={false} />
                <button type="submit" disabled={busy || !code.trim()} className={`${btnPrimary} w-full`}>{busy ? 'Enviando...' : 'Enviar solicitação'}</button>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
