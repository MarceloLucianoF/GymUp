import React, { useCallback, useEffect, useState } from 'react';
import { Copy, LogOut, Trash2, Trophy, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../common/EmptyState';
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from '../coach/styles';
import { useConfirm } from '../../hooks/useConfirm';
import { fetchStudentCheckIns } from '../../services/checkInsCache';
import {
  createChallenge, deleteChallenge, endChallenge, inviteLink, joinChallenge, leaveChallenge, listMyChallenges, scoreboard, syncMyScores
} from '../../services/challengeService';
import { CHALLENGE_MAX_MEMBERS, CHALLENGE_NAME_MAX, challengeState, dayOfChallenge, normalizeChallengeCode } from '../../utils/challenges';

const STATE_LABEL = { upcoming: 'Começa em breve', active: 'Em andamento', finished: 'Terminou', ended: 'Encerrado pelo criador' };
const medal = (pos) => (pos === 1 ? 'bg-amber-400 text-black' : pos === 2 ? 'bg-gray-300 text-black' : pos === 3 ? 'bg-orange-300 text-black' : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200');
const smallBtn = 'pressable inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold';

const defaultServices = { listMyChallenges, syncMyScores, createChallenge, joinChallenge, leaveChallenge, endChallenge, deleteChallenge, fetchStudentCheckIns };

function ChallengeCard({ ch, uid, onLeave, onEnd, onDelete }) {
  const state = challengeState(ch);
  const owner = ch.ownerId === uid;
  const rows = scoreboard(ch, uid);
  const copy = (text, msg) => navigator.clipboard?.writeText(text).then(() => toast.success(msg)).catch(() => toast.error('Não foi possível copiar.'));
  return (
    <li className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-black text-gray-900 dark:text-white">{ch.name}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {STATE_LABEL[state]}{state === 'active' ? ` · dia ${dayOfChallenge(ch)} de ${ch.durationDays}` : ` · ${ch.durationDays} dias`} · {ch.memberCount ?? rows.length}/{CHALLENGE_MAX_MEMBERS} pessoas
          </p>
        </div>
        {state !== 'ended' && state !== 'finished' && (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-gray-100 px-2 py-1 font-mono text-sm font-black tracking-widest text-gray-900 dark:bg-white/10 dark:text-white" aria-label={`Código do desafio ${ch.code}`}>{ch.code}</code>
            <button type="button" onClick={() => copy(ch.code, 'Código copiado!')} className={`${smallBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200`}><Copy className="h-4 w-4" aria-hidden="true" /> Código</button>
            <button type="button" onClick={() => copy(inviteLink(ch.code), 'Link copiado!')} className={`${smallBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200`}>Link</button>
          </div>
        )}
      </div>
      <ol className="space-y-1.5" aria-label={`Placar de ${ch.name}`}>
        {rows.map((r) => (
          <li key={r.uid} className={`flex items-center gap-3 rounded-2xl p-2.5 ${r.me ? 'bg-brand/15 ring-1 ring-brand/40' : 'bg-gray-50 dark:bg-white/5'}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${medal(r.position)}`} aria-label={`${r.position}º lugar`}>{r.position}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{r.displayName}{r.me ? ' (você)' : ''}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">@{r.handle}</p>
            </div>
            <span className="text-sm font-black text-gray-900 dark:text-white">{r.activeDays} dia{r.activeDays === 1 ? '' : 's'}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {owner ? (
          <>
            {ch.status === 'active' && <button type="button" onClick={() => onEnd(ch)} className={btnGhost}>Encerrar desafio</button>}
            <button type="button" onClick={() => onDelete(ch)} className={btnDanger}><Trash2 className="h-4 w-4" aria-hidden="true" /> Apagar desafio</button>
          </>
        ) : (
          <button type="button" onClick={() => onLeave(ch)} className={btnGhost}><LogOut className="h-4 w-4" aria-hidden="true" /> Sair do desafio</button>
        )}
      </div>
    </li>
  );
}

/** Aba "Desafios" da tela Amigos: criar (7/30 dias), entrar por código, placar de dias ativos e sair. */
export default function ChallengesTab({ uid, profile, initialCode = '', onGo, services = defaultServices }) {
  const { confirm, dialog } = useConfirm();
  const [list, setList] = useState(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState({ name: '', durationDays: 7 });
  const [code, setCode] = useState(normalizeChallengeCode(initialCode));
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!uid || !profile) return;
    try {
      const mine = await services.listMyChallenges(uid);
      setList(mine);
      setError(false);
      // Atualiza o próprio placar a partir dos check-ins do aparelho (só grava quando mudou).
      if (mine.some((c) => c.status === 'active')) {
        const checkIns = await services.fetchStudentCheckIns(uid).catch(() => []);
        setList(await services.syncMyScores(uid, mine, checkIns, profile));
      }
    } catch (err) {
      console.error('Desafios:', err);
      setError(true);
      setList((l) => l || []);
    }
  }, [uid, profile, services]);

  useEffect(() => { load(); }, [load]);

  if (!profile) return <EmptyState icon={Trophy} title="Crie seu perfil social primeiro" description="Nos desafios, os outros participantes veem seu nome público e @usuário e quantos dias você treinou." action={onGo ? <button type="button" onClick={() => onGo('profile')} className={btnPrimary}>Criar perfil</button> : null} />;

  const run = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); await load(); }
    catch (err) { console.error(err); toast.error(err?.message && !err.code ? err.message : 'Não foi possível concluir. Tente de novo.'); }
    finally { setBusy(''); }
  };

  const create = (e) => {
    e.preventDefault();
    run('create', async () => { await services.createChallenge(uid, profile, form); setForm({ name: '', durationDays: 7 }); }, 'Desafio criado! Compartilhe o código.');
  };
  const join = (e) => {
    e.preventDefault();
    run('join', async () => {
      const r = await services.joinChallenge(uid, profile, code);
      setCode('');
      if (r?.already) toast('Você já está nesse desafio.');
    }, 'Você entrou no desafio.');
  };
  const leave = async (ch) => {
    if (!await confirm({ title: 'Sair do desafio?', message: 'Seu nome e seus dias ativos saem do placar. Dá para voltar com o código enquanto o desafio estiver aberto.', confirmLabel: 'Sair', danger: true })) return;
    run('leave', () => services.leaveChallenge(uid, ch.id), 'Você saiu do desafio.');
  };
  const end = async (ch) => {
    if (!await confirm({ title: 'Encerrar o desafio?', message: 'O placar congela e ninguém mais entra. Ele continua visível para os participantes.', confirmLabel: 'Encerrar' })) return;
    run('end', () => services.endChallenge(ch.id), 'Desafio encerrado.');
  };
  const remove = async (ch) => {
    if (!await confirm({ title: 'Apagar o desafio?', message: 'O desafio e o placar somem para todos os participantes. Não dá para desfazer.', confirmLabel: 'Apagar', danger: true })) return;
    run('delete', () => services.deleteChallenge(ch.id, ch.code), 'Desafio apagado.');
  };

  return (
    <div className="space-y-4">
      {dialog}
      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={create} className="surface space-y-3 p-4" aria-labelledby="ch-new-title">
          <h2 id="ch-new-title" className="font-display text-lg font-black text-gray-900 dark:text-white">Criar desafio</h2>
          <div>
            <label htmlFor="ch-name" className={labelCls}>Nome</label>
            <input id="ch-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={CHALLENGE_NAME_MAX} className={inputCls} placeholder="Ex.: Novembro sem falta" />
          </div>
          <fieldset>
            <legend className={labelCls}>Duração</legend>
            <div className="flex gap-2">
              {[7, 30].map((n) => (
                <label key={n} className={`${smallBtn} cursor-pointer ${form.durationDays === n ? 'bg-brand text-black' : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200'}`}>
                  <input type="radio" name="ch-duration" value={n} checked={form.durationDays === n} onChange={() => setForm((f) => ({ ...f, durationDays: n }))} className="sr-only" />
                  {n} dias
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" disabled={busy === 'create' || !form.name.trim()} className={btnPrimary}>{busy === 'create' ? 'Criando...' : 'Criar desafio'}</button>
        </form>
        <form onSubmit={join} className="surface space-y-3 p-4" aria-labelledby="ch-join-title">
          <h2 id="ch-join-title" className="font-display text-lg font-black text-gray-900 dark:text-white">Entrar com código</h2>
          <div>
            <label htmlFor="ch-code" className={labelCls}>Código do desafio</label>
            <input id="ch-code" value={code} onChange={(e) => setCode(normalizeChallengeCode(e.target.value).slice(0, 8))} className={`${inputCls} font-mono tracking-widest`} autoCapitalize="characters" spellCheck={false} placeholder="8 letras ou números" />
          </div>
          <button type="submit" disabled={busy === 'join' || code.length !== 8} className={btnPrimary}>{busy === 'join' ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">O placar conta os dias com pelo menos um treino registrado no app durante o desafio (no máximo 1 por dia). Os participantes veem só seu nome público, @usuário e esse número: nada de cargas, medidas ou fotos. Até {CHALLENGE_MAX_MEMBERS} pessoas por desafio.</p>
      {error && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-400">Não foi possível carregar seus desafios agora.</p>}
      {list === null ? <p className="text-sm text-gray-600 dark:text-gray-400">Carregando desafios...</p>
        : list.length === 0 ? <EmptyState icon={Users} title="Nenhum desafio ainda" description="Crie um desafio de 7 ou 30 dias e envie o código para os amigos, ou entre com o código que recebeu." />
          : <ul className="space-y-3">{list.map((ch) => <ChallengeCard key={ch.id} ch={ch} uid={uid} onLeave={leave} onEnd={end} onDelete={remove} />)}</ul>}
    </div>
  );
}
