import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Copy, Flag, Heart, Search, Shield, UserMinus, UserPlus, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/coach/Tabs';
import EmptyState from '../../components/common/EmptyState';
import PageSkeleton from '../../components/coach/PageSkeleton';
import ErrorState from '../../components/common/ErrorState';
import { btnGhost, btnPrimary, inputCls, labelCls, pageCls } from '../../components/coach/styles';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import useSocial from '../../hooks/useSocial';
import usePageMeta from '../../hooks/usePageMeta';
import { REPORT_REASONS, deleteMyPosts, deletePost, likesOnMyPosts, likesSeenAt, listFeed, markLikesSeen, reportPost, setLike } from '../../services/feedService';
import { newLikes, postLine, timeAgo } from '../../utils/feed';
import { findByHandleOrCode, otherOf, relationOf, respond, saveSocialProfile, sendRequest, validateHandle, normalizeHandle } from '../../services/socialService';

const TABS = [['ranking', 'Ranking'], ['activity', 'Atividade'], ['friends', 'Amigos'], ['search', 'Buscar'], ['profile', 'Meu perfil']];
const medal = (pos) => (pos === 1 ? 'bg-amber-400 text-black' : pos === 2 ? 'bg-gray-300 text-black' : pos === 3 ? 'bg-orange-300 text-black' : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200');
const smallBtn = 'pressable inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold';
const Person = ({ p, fallback = 'Usuário' }) => (
  <div className="min-w-0"><p className="truncate font-bold text-gray-900 dark:text-white">{p?.displayName || fallback}</p>{p?.handle && <p className="text-xs text-gray-600 dark:text-gray-400">@{p.handle}</p>}</div>
);

function RankingTab({ social, onGo, onJoin }) {
  const { ranking, profile } = social;
  if (!profile) return <EmptyState icon={Users} title="Crie seu perfil social" description="Escolha um @usuário para convidar amigos e entrar no ranking de consistência." action={<button type="button" onClick={() => onGo('profile')} className={btnPrimary}>Criar perfil</button>} />;
  if (!ranking.participating) {
    return (
      <div className="surface space-y-3 p-5">
        <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">Participar do ranking</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">Você e seus amigos que também participam veem treinos da semana, dias ativos e sequência. Nenhum peso, medida ou carga é compartilhado. Você pode sair quando quiser, sem desfazer amizades.</p>
        <button type="button" onClick={onJoin} className={btnPrimary}>Participar do ranking</button>
      </div>
    );
  }
  if (ranking.rows.length <= 1) {
    return <EmptyState icon={Users} title="Seu ranking está esperando amigos" description="Adicione amigos que também participam do ranking. Enquanto isso, seus treinos da semana aparecem aqui." action={<button type="button" onClick={() => onGo('search')} className={btnPrimary}>Buscar amigos</button>} />;
  }
  return (
    <section className="surface p-4" aria-labelledby="rank-title">
      <h2 id="rank-title" className="font-display text-lg font-black text-gray-900 dark:text-white">Ranking dos seus amigos — esta semana</h2>
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">Consistência registrada. Não é uma competição oficial: quem não registra um treino no app não aparece com ele.</p>
      <ol className="space-y-2">
        {ranking.rows.map((r) => (
          <li key={r.uid} className={`flex items-center gap-3 rounded-2xl p-3 ${r.me ? 'bg-brand/15 ring-1 ring-brand/40' : 'bg-gray-50 dark:bg-white/5'}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${medal(r.position)}`} aria-label={`${r.position}º lugar`}>{r.position}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-gray-900 dark:text-white">{r.name}{r.me ? ' (você)' : ''}</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{r.workouts} treino{r.workouts === 1 ? '' : 's'} · {r.activeDays} dia{r.activeDays === 1 ? '' : 's'} ativo{r.activeDays === 1 ? '' : 's'}{r.streak > 1 ? ` · sequência de ${r.streak} dias` : ''}</p>
            </div>
            {r.goalMet && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:text-emerald-300">Meta cumprida</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FriendsTab({ social, uid, act, onGo }) {
  const { friendships, people } = social;
  const byStatus = (fn) => friendships.filter(fn);
  const incoming = byStatus((f) => relationOf(f, uid) === 'pending-in');
  const outgoing = byStatus((f) => relationOf(f, uid) === 'pending-out');
  const active = byStatus((f) => f.status === 'active');
  const blocked = byStatus((f) => relationOf(f, uid) === 'blocked-by-me');
  const row = (f, buttons) => {
    const other = otherOf(f, uid);
    return (
      <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
        <Person p={people[other]} /><div className="ml-auto flex flex-wrap gap-2">{buttons(other)}</div>
      </li>
    );
  };
  const empty = incoming.length + outgoing.length + active.length + blocked.length === 0;
  if (empty) return <EmptyState icon={Users} title="Você ainda não tem amigos no app" description="Busque pelo @usuário ou código de um amigo." action={<button type="button" onClick={() => onGo('search')} className={btnPrimary}>Buscar amigos</button>} />;
  const Section = ({ title, items, children }) => items.length ? (<section className="surface space-y-2 p-4"><h2 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">{title} ({items.length})</h2><ul className="space-y-2">{children}</ul></section>) : null;
  return (
    <div className="space-y-4">
      <Section title="Pedidos recebidos" items={incoming}>{incoming.map((f) => row(f, (o) => (<>
        <button type="button" onClick={() => act(o, 'accept')} className={`${smallBtn} bg-gradient-to-r from-brand to-[#FF9800] text-black`}><Check className="h-4 w-4" aria-hidden="true" /> Aceitar</button>
        <button type="button" onClick={() => act(o, 'decline')} className={`${smallBtn} bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-gray-100`}><X className="h-4 w-4" aria-hidden="true" /> Recusar</button></>)))}</Section>
      <Section title="Pedidos enviados" items={outgoing}>{outgoing.map((f) => row(f, (o) => (
        <button type="button" onClick={() => act(o, 'cancel')} className={`${smallBtn} bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-gray-100`}>Cancelar pedido</button>)))}</Section>
      <Section title="Amigos" items={active}>{active.map((f) => row(f, (o) => (<>
        <button type="button" onClick={() => act(o, 'remove')} className={`${smallBtn} bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-gray-100`}><UserMinus className="h-4 w-4" aria-hidden="true" /> Remover</button>
        <button type="button" onClick={() => act(o, 'block')} className={`${smallBtn} bg-rose-500/10 text-rose-700 dark:text-rose-400`}><Shield className="h-4 w-4" aria-hidden="true" /> Bloquear</button></>)))}</Section>
      <Section title="Bloqueados" items={blocked}>{blocked.map((f) => row(f, (o) => (
        <button type="button" onClick={() => act(o, 'unblock')} className={`${smallBtn} bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-gray-100`}>Desbloquear</button>)))}</Section>
    </div>
  );
}

function SearchTab({ social, uid, initialQuery, reload }) {
  const [term, setTerm] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const relFor = (id) => relationOf(social.friendships.find((f) => otherOf(f, uid) === id), uid);

  const run = async (e) => {
    e?.preventDefault();
    if (!term.trim()) return;
    setBusy(true);
    try {
      const direct = await findByHandleOrCode(term);
      setResults(direct ? [direct] : []);
    } catch (error) { console.error(error); toast.error('Não foi possível buscar agora.'); setResults([]); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (initialQuery) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (id) => {
    try {
      const r = await sendRequest(uid, id);
      toast.success(r === 'accepted' ? 'Vocês agora são amigos!' : 'Pedido enviado.');
      await reload();
    } catch (error) { toast.error(error.message || 'Não foi possível enviar o pedido.'); }
  };

  if (!social.profile) return <EmptyState icon={Users} title="Crie seu perfil social primeiro" description="Para pedir amizade, você precisa de um @usuário." />;
  return (
    <div className="space-y-4">
      <form onSubmit={run} className="surface flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-400" aria-hidden="true" />
          <input type="search" aria-label="Buscar por @usuário ou código" placeholder="@usuário ou código do amigo" value={term} onChange={(e) => setTerm(e.target.value)} className={`${inputCls} !pl-11`} />
        </div>
        <button type="submit" disabled={busy || !term.trim()} className={btnPrimary}>{busy ? 'Buscando...' : 'Buscar'}</button>
      </form>
      {results && results.length === 0 && <EmptyState icon={Search} title="Ninguém encontrado" description="Confira o @usuário ou o código de amigo e tente de novo. Peça à pessoa que o envie." />}
      {results && results.length > 0 && (
        <ul className="space-y-2">
          {results.filter((p) => p.uid !== uid).map((p) => {
            const rel = relFor(p.uid);
            return (
              <li key={p.uid} className="surface flex items-center gap-3 p-3">
                <Person p={p} />
                <div className="ml-auto">
                  {rel === 'none' && <button type="button" onClick={() => add(p.uid)} className={`${smallBtn} bg-gradient-to-r from-brand to-[#FF9800] text-black`}><UserPlus className="h-4 w-4" aria-hidden="true" /> Adicionar</button>}
                  {rel === 'pending-out' && <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Pedido enviado</span>}
                  {rel === 'pending-in' && <button type="button" onClick={() => add(p.uid)} className={`${smallBtn} bg-gradient-to-r from-brand to-[#FF9800] text-black`}>Aceitar pedido</button>}
                  {rel === 'active' && <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Já são amigos</span>}
                  {(rel === 'blocked' || rel === 'blocked-by-me') && <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Indisponível</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ActivityTab({ social, uid, onGo }) {
  const { profile, friendships } = social;
  const [state, setState] = useState({ loading: true, error: false, posts: [], likes: [], seenAt: '' });
  const [reporting, setReporting] = useState(null);
  const load = React.useCallback(async () => {
    try {
      const seenAt = likesSeenAt(uid);
      const [posts, likes] = await Promise.all([listFeed(uid, friendships), likesOnMyPosts(uid).catch(() => [])]);
      setState({ loading: false, error: false, posts, likes: newLikes(likes, seenAt), seenAt });
      markLikesSeen(uid);
    } catch (error) { console.error('Erro no feed:', error); setState((st) => ({ ...st, loading: false, error: true, posts: [] })); }
  }, [uid, friendships]);
  useEffect(() => { if (profile) load(); }, [profile, load]);
  if (!profile) return <EmptyState icon={Users} title="Crie seu perfil social" description="Com o perfil você vê o que seus amigos treinaram." action={<button type="button" onClick={() => onGo('profile')} className={btnPrimary}>Criar perfil</button>} />;
  if (state.loading) return <PageSkeleton />;
  if (state.error) return <ErrorState onRetry={load} />;
  const like = async (post) => {
    setState((st) => ({ ...st, posts: st.posts.map((x) => (x.id === post.id ? { ...x, liked: !x.liked, likeCount: x.likeCount + (x.liked ? -1 : 1) } : x)) }));
    try { await setLike(post.id, uid, !post.liked); } catch (_) { toast.error('Não foi possível curtir.'); load(); }
  };
  const remove = async (post) => {
    try { await deletePost(post.id); toast.success('Publicação apagada.'); load(); } catch (_) { toast.error('Não foi possível apagar.'); }
  };
  const report = async (post, reason) => {
    try {
      await reportPost(uid, post, reason);
      setReporting(null);
      setState((st) => ({ ...st, posts: st.posts.filter((x) => x.id !== post.id) }));
      toast.success('Denúncia enviada. A publicação saiu do seu feed.');
    } catch (error) {
      setReporting(null);
      toast.error(error?.code === 'permission-denied' ? 'Você já denunciou esta publicação.' : 'Não foi possível denunciar.');
    }
  };
  return (
    <section className="space-y-3" aria-labelledby="act-title">
      <h2 id="act-title" className="font-display text-lg font-black text-gray-900 dark:text-white">Atividade dos amigos</h2>
      {state.likes.length > 0 && (
        <div className="rounded-2xl bg-rose-500/10 p-3" role="status" aria-label="Curtidas novas">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-rose-800 dark:text-rose-200"><Heart className="h-4 w-4" aria-hidden="true" fill="currentColor" /> Curtidas novas</p>
          <ul className="space-y-0.5 text-sm text-gray-800 dark:text-gray-200">
            {state.likes.slice(0, 8).map((l) => <li key={`${l.postId}-${l.likerId}`}><b>{social.people[l.likerId]?.displayName || 'Um amigo'}</b> curtiu <b>{l.title}</b> · <span className="text-xs text-gray-600 dark:text-gray-400">{timeAgo(l.at)}</span></li>)}
          </ul>
        </div>
      )}
      {!profile.shareWorkouts && <p className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-700 dark:bg-white/5 dark:text-gray-300">Você não publica seus treinos. <button type="button" onClick={() => onGo('profile')} className="font-bold text-brand underline">Ativar em Meu perfil</button></p>}
      {state.posts.length === 0 ? <EmptyState icon={Users} title="Nada por aqui ainda" description="Quando você ou seus amigos concluírem treinos e publicarem, eles aparecem aqui." /> : (
        <ul className="space-y-2">
          {state.posts.map((post) => {
            const mine = post.authorId === uid;
            const who = mine ? { displayName: 'Você' } : social.people[post.authorId];
            return (
              <li key={post.id} className="surface p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-900 dark:text-white"><b>{who?.displayName || 'Amigo'}</b> concluiu <b>{post.title}</b></p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{postLine(post)} · {timeAgo(post.createdAt)}</p>
                  </div>
                  <button type="button" onClick={() => like(post)} aria-pressed={post.liked} aria-label={post.liked ? 'Descurtir' : 'Curtir'} className={`${smallBtn} ${post.liked ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200'}`}><Heart className="h-4 w-4" aria-hidden="true" fill={post.liked ? 'currentColor' : 'none'} /> {post.likeCount}</button>
                  {mine
                    ? <button type="button" onClick={() => remove(post)} aria-label="Apagar publicação" className={`${smallBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200`}><X className="h-4 w-4" aria-hidden="true" /></button>
                    : <button type="button" onClick={() => setReporting(reporting === post.id ? null : post.id)} aria-expanded={reporting === post.id} aria-label="Denunciar publicação" className={`${smallBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200`}><Flag className="h-4 w-4" aria-hidden="true" /></button>}
                </div>
                {reporting === post.id && (
                  <div className="mt-2 rounded-xl bg-gray-50 p-2 dark:bg-white/5" role="group" aria-label="Motivo da denúncia">
                    <p className="mb-1 text-xs text-gray-700 dark:text-gray-300">Por que denunciar? A publicação sai do seu feed e a equipe analisa. Quem publicou não sabe quem denunciou.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {REPORT_REASONS.map(([id, label]) => <button key={id} type="button" onClick={() => report(post, id)} className={`${smallBtn} bg-white text-gray-900 ring-1 ring-gray-200 dark:bg-white/10 dark:text-white dark:ring-white/10`}>{label}</button>)}
                      <button type="button" onClick={() => setReporting(null)} className={`${smallBtn} text-gray-700 dark:text-gray-300`}>Cancelar</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-gray-600 dark:text-gray-400">Algo errado com um amigo? Em Amigos você pode remover ou bloquear a pessoa.</p>
    </section>
  );
}

function ProfileTab({ social, user, profile: studentProfile, reload }) {
  const { profile } = social;
  const suggested = normalizeHandle((user.displayName || 'aluno').split(' ')[0]).replace(/[^a-z0-9_]/g, '');
  const [form, setForm] = useState({
    displayName: profile?.displayName || user.displayName || '',
    handle: profile?.handle || (suggested.length >= 3 ? suggested : `${suggested}_${Math.floor(Math.random() * 90 + 10)}`),
    discoverable: profile?.discoverable ?? false,
    shareRanking: profile?.shareRanking ?? false,
    shareWorkouts: profile?.shareWorkouts ?? false,
    weeklyGoal: profile?.weeklyGoal || studentProfile?.weeklyGoal || 4
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateHandle(normalizeHandle(form.handle));
    if (problem) { setError(problem); return; }
    setError(''); setSaving(true);
    try {
      await saveSocialProfile(user, form, profile);
      if (profile?.shareWorkouts && !form.shareWorkouts) { try { await deleteMyPosts(user.uid); } catch (_) { /* os posts já ficam ocultos pelas regras */ } }
      toast.success(profile?.shareWorkouts && !form.shareWorkouts ? 'Perfil salvo. Suas publicações foram apagadas.' : 'Perfil social salvo.');
      await reload();
    }
    catch (err) { setError(err.message || 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };

  const copy = (text, msg) => navigator.clipboard?.writeText(text).then(() => toast.success(msg)).catch(() => toast.error('Não foi possível copiar.'));
  return (
    <form onSubmit={submit} noValidate className="surface space-y-5 p-5">
      <p className="text-sm text-gray-700 dark:text-gray-300">Só estas informações ficam visíveis para outras pessoas. Peso, medidas, treinos detalhados e histórico <b>nunca</b> são compartilhados por aqui.</p>
      <div><label htmlFor="sp-name" className={labelCls}>Nome público</label><input id="sp-name" value={form.displayName} onChange={set('displayName')} className={inputCls} maxLength={60} /></div>
      <div>
        <label htmlFor="sp-handle" className={labelCls}>@usuário</label>
        <input id="sp-handle" value={form.handle} onChange={set('handle')} className={`${inputCls} font-mono`} autoCapitalize="none" spellCheck={false} aria-describedby="sp-handle-hint" />
        <p id="sp-handle-hint" className="mt-1 text-xs text-gray-600 dark:text-gray-400">De 3 a 20 letras minúsculas, números ou _. Único no app.</p>
      </div>
      <label className="flex min-h-[48px] items-start gap-3"><input type="checkbox" checked={form.discoverable} onChange={set('discoverable')} className="mt-1 h-5 w-5 accent-brand" /><span><span className="block font-bold text-gray-900 dark:text-white">Mostrar meu nome a quem me achar</span><span className="text-xs text-gray-600 dark:text-gray-400">Desligado, quem tem seu @usuário ou código vê só o @usuário até vocês serem amigos.</span></span></label>
      <label className="flex min-h-[48px] items-start gap-3"><input type="checkbox" checked={form.shareRanking} onChange={set('shareRanking')} className="mt-1 h-5 w-5 accent-brand" /><span><span className="block font-bold text-gray-900 dark:text-white">Participar do ranking entre amigos</span><span className="text-xs text-gray-600 dark:text-gray-400">Amigos que também participam veem seus treinos da semana, dias ativos e sequência.</span></span></label>
      <label className="flex min-h-[48px] items-start gap-3"><input type="checkbox" checked={form.shareWorkouts} onChange={set('shareWorkouts')} className="mt-1 h-5 w-5 accent-brand" /><span><span className="block font-bold text-gray-900 dark:text-white">Publicar meus treinos para amigos</span><span className="text-xs text-gray-600 dark:text-gray-400">Ao concluir um treino, seus amigos veem o nome, a duração e o número de séries. Nunca cargas, medidas ou saúde. Dá para apagar cada publicação.</span></span></label>
      <div><label htmlFor="sp-goal" className={labelCls}>Meta semanal (treinos)</label><input id="sp-goal" type="number" min={2} max={7} value={form.weeklyGoal} onChange={set('weeklyGoal')} className={`${inputCls} sm:w-40`} /></div>
      {profile && (
        <div className="rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Seu código de amigo</p>
          <div className="mt-1 flex flex-wrap items-center gap-2"><code className="font-mono text-xl font-black tracking-widest text-gray-900 dark:text-white">{profile.friendCode}</code>
            <button type="button" onClick={() => copy(profile.friendCode, 'Código copiado!')} className={btnGhost}><Copy className="h-4 w-4" aria-hidden="true" /> Copiar</button>
            <button type="button" onClick={() => copy(`${window.location.origin}/amigos?buscar=${profile.friendCode}`, 'Link copiado!')} className={btnGhost}>Copiar link</button></div>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-400">{error}</p>}
      <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Salvando...' : profile ? 'Salvar alterações' : 'Criar perfil social'}</button>
    </form>
  );
}

export default function Friends() {
  usePageMeta('Amigos', 'Amigos e ranking de consistência.', { noindex: true });
  const { user, userProfile } = useAuthContext();
  const { confirm, dialog } = useConfirm();
  const [params] = useSearchParams();
  const social = useSocial(user?.uid);
  const [tab, setTab] = useState(params.get('buscar') ? 'search' : params.get('aba') === 'atividade' ? 'activity' : 'ranking');
  const uid = user?.uid;
  const pendingIn = useMemo(() => social.friendships.filter((f) => relationOf(f, uid) === 'pending-in').length, [social.friendships, uid]);

  const act = async (other, action) => {
    if (action === 'block' || action === 'remove') {
      const ok = await confirm({ title: action === 'block' ? 'Bloquear esta pessoa?' : 'Remover amigo?', message: action === 'block' ? 'Ela não consegue mais pedir amizade e some do seu ranking.' : 'Vocês saem do ranking um do outro.', confirmLabel: action === 'block' ? 'Bloquear' : 'Remover', danger: true });
      if (!ok) return;
    }
    try { await respond(uid, other, action); await social.reload(); toast.success('Pronto.'); }
    catch (error) { console.error(error); toast.error('Não foi possível concluir. Tente de novo.'); }
  };

  const join = async () => {
    try { await saveSocialProfile(user, { ...social.profile, shareRanking: true }, social.profile); toast.success('Você entrou no ranking.'); await social.reload(); }
    catch (error) { console.error(error); toast.error('Não foi possível entrar no ranking.'); }
  };

  if (social.loading) return <div className={pageCls}><div className="mx-auto max-w-3xl"><PageSkeleton cards={3} /></div></div>;
  if (social.error) return <div className={pageCls}><ErrorState onRetry={() => social.reload()} /></div>;

  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader eyebrow="Social" title="Amigos" subtitle="Compare consistência com quem treina com você, sem expor seus dados de saúde." />
        <Tabs tabs={TABS.map(([id, label]) => ({ id, label: id === 'friends' && pendingIn ? `${label} (${pendingIn})` : label }))} value={tab} onChange={setTab} />
        {tab === 'ranking' && <RankingTab social={social} onGo={setTab} onJoin={join} />}
        {tab === 'activity' && <ActivityTab social={social} uid={uid} onGo={setTab} />}
        {tab === 'friends' && <FriendsTab social={social} uid={uid} act={act} onGo={setTab} />}
        {tab === 'search' && <SearchTab social={social} uid={uid} initialQuery={params.get('buscar') || ''} reload={social.reload} />}
        {tab === 'profile' && <ProfileTab key={social.profile?.updatedAt || 'novo'} social={social} user={user} profile={userProfile} reload={social.reload} />}
      </div>
    </div>
  );
}
