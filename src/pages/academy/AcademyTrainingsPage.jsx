import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import Modal from '../../components/common/Modal';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import PageSkeleton from '../../components/coach/PageSkeleton';
import ErrorState from '../../components/common/ErrorState';
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls, pageCls } from '../../components/coach/styles';
import ExerciseThumb from '../../components/ui/ExerciseThumb';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import usePageMeta from '../../hooks/usePageMeta';
import { getMemberName, listAcademyAssignments, listAcademyMembers, listMyAssignments, listMyMemberships } from '../../services/academyService';
import {
  assignVersion, canAuthorTrainings, countByVersion, createDraft, deleteDraft, draftChanged, listAssignedForAcademy, listSeries, listVersions,
  loadExerciseLibrary, MAX_EXERCISES, publishDraft, saveDraft, toDraftExercise, versionIdOf
} from '../../services/academyTrainingService';

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function DraftEditor({ series, library, onClose, onSave, busy }) {
  const [name, setName] = useState(series?.draft?.name || '');
  const [exercises, setExercises] = useState(series?.draft?.exercises || []);
  const [term, setTerm] = useState('');
  const results = useMemo(() => {
    const q = norm(term);
    const used = new Set(exercises.map((e) => norm(e.name)));
    return library.filter((l) => !used.has(norm(l.name)) && (!q || norm(`${l.name} ${l.muscleGroup}`).includes(q))).slice(0, 8);
  }, [library, term, exercises]);

  const patch = (i, key, value) => setExercises((list) => list.map((e, idx) => (idx === i ? { ...e, [key]: value } : e)));
  const move = (i, dir) => setExercises((list) => { const next = [...list]; const j = i + dir; if (j < 0 || j >= next.length) return list; [next[i], next[j]] = [next[j], next[i]]; return next; });
  const add = (lib) => { if (exercises.length >= MAX_EXERCISES) { toast.error(`No máximo ${MAX_EXERCISES} exercícios.`); return; } setExercises((list) => [...list, toDraftExercise(lib)]); setTerm(''); };
  const valid = name.trim().length >= 2 && name.trim().length <= 80;

  return (
    <Modal onClose={onClose} label={series ? 'Editar rascunho da ficha' : 'Nova ficha'} className="w-full max-w-2xl">
      <div className="surface relative max-h-[90dvh] overflow-y-auto bg-white p-5 dark:bg-gray-900">
        <button type="button" aria-label="Fechar" onClick={onClose} className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        <h2 className="font-display text-xl font-black text-gray-900 dark:text-white">{series ? 'Editar rascunho' : 'Nova ficha (rascunho)'}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">O rascunho só vira ficha de uso quando você publica uma versão. Versões publicadas nunca mudam.</p>
        <label htmlFor="draft-name" className={`${labelCls} mt-4`}>Nome da ficha</label>
        <input id="draft-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} />

        <h3 className="mt-5 font-bold text-gray-900 dark:text-white">Exercícios ({exercises.length})</h3>
        <ul className="mt-2 space-y-2">
          {exercises.length === 0 && <li className="text-sm text-gray-600 dark:text-gray-400">Nenhum exercício ainda. Busque abaixo e adicione.</li>}
          {exercises.map((e, i) => (
            <li key={`${e.name}-${i}`} className="rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10"><ExerciseThumb src={e.machineImage} /></span><span className="truncate text-sm font-bold text-gray-900 dark:text-white">{i + 1}. {e.name}</span></span>
                <span className="flex gap-1">
                  <button type="button" aria-label={`Subir ${e.name}`} disabled={i === 0} onClick={() => move(i, -1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-white/10"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Descer ${e.name}`} disabled={i === exercises.length - 1} onClick={() => move(i, 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-white/10"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Remover ${e.name}`} onClick={() => setExercises((list) => list.filter((_, idx) => idx !== i))} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div><label className="text-xs font-bold text-gray-600 dark:text-gray-400" htmlFor={`s-${i}`}>Séries</label><input id={`s-${i}`} value={e.sets} onChange={(ev) => patch(i, 'sets', ev.target.value)} maxLength={10} className={inputCls} inputMode="numeric" /></div>
                <div><label className="text-xs font-bold text-gray-600 dark:text-gray-400" htmlFor={`r-${i}`}>Repetições</label><input id={`r-${i}`} value={e.reps} onChange={(ev) => patch(i, 'reps', ev.target.value)} maxLength={20} className={inputCls} /></div>
                <div><label className="text-xs font-bold text-gray-600 dark:text-gray-400" htmlFor={`d-${i}`}>Descanso (s)</label><input id={`d-${i}`} type="number" min="0" max="300" value={e.rest} onChange={(ev) => patch(i, 'rest', Math.min(300, Math.max(0, Math.round(Number(ev.target.value) || 0))))} className={inputCls} /></div>
              </div>
            </li>
          ))}
        </ul>

        <label htmlFor="draft-search" className={`${labelCls} mt-5`}>Adicionar da biblioteca</label>
        <input id="draft-search" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar exercício (nome ou grupo)" className={inputCls} />
        <ul className="mt-2 space-y-1">
          {results.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => add(l)} className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-gray-50 px-3 text-left text-sm hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10">
                <span className="flex min-w-0 items-center gap-2"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-white/10"><ExerciseThumb src={l.machineImage} iconClassName="h-5 w-5" /></span><span className="truncate font-semibold text-gray-900 dark:text-white">{l.name}{l.mediaApprox ? <span className="ml-1 text-[10px] font-normal text-gray-600 dark:text-gray-400">(imagem de referência)</span> : null}</span></span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-gray-600 dark:text-gray-400">{l.muscleGroup}<Plus className="h-4 w-4" aria-hidden="true" /></span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="button" disabled={!valid || busy} onClick={() => onSave({ name, exercises })} className={btnPrimary}>{busy ? 'Salvando...' : 'Salvar rascunho'}</button>
        </div>
      </div>
    </Modal>
  );
}

function AssignModal({ series, versions, students, onClose, onAssign, busy }) {
  const published = versions.filter((v) => v.seriesId === series.id).sort((a, b) => b.version - a.version);
  const [version, setVersion] = useState(published[0]?.version || '');
  const [studentId, setStudentId] = useState('');
  return (
    <Modal onClose={onClose} label="Atribuir ficha" className="w-full max-w-md">
      <div className="surface relative bg-white p-5 dark:bg-gray-900">
        <button type="button" aria-label="Fechar" onClick={onClose} className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        <h2 className="font-display text-xl font-black text-gray-900 dark:text-white">Atribuir {series.name}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">O aluno fica com a versão escolhida. Publicar uma versão nova depois não muda a ficha dele.</p>
        <label htmlFor="as-version" className={`${labelCls} mt-4`}>Versão publicada</label>
        <select id="as-version" value={version} onChange={(e) => setVersion(Number(e.target.value))} className={inputCls}>
          {published.map((v) => <option key={v.id} value={v.version}>Versão {v.version}</option>)}
        </select>
        <label htmlFor="as-student" className={`${labelCls} mt-3`}>Aluno</label>
        <select id="as-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}>
          <option value="">Escolher aluno</option>
          {students.map((s) => <option key={s.userId} value={s.userId}>{s.displayName}</option>)}
        </select>
        {students.length === 0 && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Nenhum aluno disponível para você atribuir.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="button" disabled={!version || !studentId || busy} onClick={() => onAssign(studentId, Number(version))} className={btnPrimary}>{busy ? 'Atribuindo...' : 'Atribuir'}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function AcademyTrainingsPage() {
  usePageMeta('Fichas da academia', 'Fichas versionadas da academia.', { noindex: true });
  const { academyId } = useParams();
  const { user, userProfile } = useAuthContext();
  const { confirm, dialog } = useConfirm();
  const actor = { uid: user?.uid, displayName: userProfile?.displayName || '' };
  const [membership, setMembership] = useState(undefined);
  const [series, setSeries] = useState([]);
  const [versions, setVersions] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [students, setStudents] = useState([]);
  const [library, setLibrary] = useState([]);
  const [error, setError] = useState(false);
  const [editor, setEditor] = useState(null);       // null | 'new' | série
  const [assigning, setAssigning] = useState(null); // série
  const [busy, setBusy] = useState('');

  const isStaff = membership && ['owner', 'admin'].includes(membership.role);
  const canAuthor = canAuthorTrainings(membership);

  const load = useCallback(async () => {
    try {
      setError(false);
      const mine = (await listMyMemberships(user.uid)).find((m) => m.academyId === academyId) || null;
      setMembership(mine);
      if (!mine || !['owner', 'admin', 'teacher'].includes(mine.role)) return;
      const staff = ['owner', 'admin'].includes(mine.role);
      const [s, v, a] = await Promise.all([listSeries(academyId), listVersions(academyId), listAssignedForAcademy(academyId, { isStaff: staff, userId: user.uid })]);
      setSeries(s); setVersions(v); setAssigned(a);
      // alunos que este usuário pode atribuir: toda a academia (equipe) ou os que o aceitaram como professor responsável
      if (staff) {
        const [members, asg] = await Promise.all([listAcademyMembers(academyId), listAcademyAssignments(academyId)]);
        setStudents(members.filter((m) => m.role === 'student' && m.status === 'active').map((m) => ({ userId: m.userId, displayName: m.displayName || 'Aluno', teacherId: asg.find((x) => x.studentId === m.userId && x.status === 'active')?.teacherId || '' })));
      } else {
        const mineAsg = (await listMyAssignments(user.uid, 'teacher')).filter((x) => x.academyId === academyId && x.status === 'active');
        const named = await Promise.all(mineAsg.map(async (x) => ({ userId: x.studentId, displayName: await getMemberName(academyId, x.studentId), teacherId: user.uid })));
        setStudents(named.filter((x) => x.displayName));
      }
    } catch (e) { console.error(e); setError(true); }
  }, [academyId, user?.uid]);
  useEffect(() => { if (user?.uid) load(); }, [user?.uid, load]);
  useEffect(() => { if (canAuthor && library.length === 0) loadExerciseLibrary().then(setLibrary).catch((e) => console.error(e)); }, [canAuthor, library.length]);

  const counts = useMemo(() => countByVersion(assigned), [assigned]);
  const versionsOf = (id) => versions.filter((v) => v.seriesId === id).sort((a, b) => b.version - a.version);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); toast.success(okMsg); await load(); return true; }
    catch (e) { console.error(e); toast.error('Não foi possível concluir. Você pode ter perdido a permissão ou a ficha mudou; a lista foi atualizada.'); await load(); return false; }
    finally { setBusy(''); }
  };

  const save = async ({ name, exercises }) => {
    const ok = await run('save', () => (editor === 'new' ? createDraft(actor, academyId, name, exercises) : saveDraft(actor, editor, { name, exercises })), 'Rascunho salvo.');
    if (ok) setEditor(null);
  };
  const publish = async (s) => {
    const next = (s.currentVersion || 0) + 1;
    if (!(await confirm({ title: `Publicar versão ${next} de ${s.name}?`, message: 'A versão publicada não pode mais ser alterada. Alunos que já usam outra versão continuam com ela.', confirmLabel: 'Publicar' }))) return;
    await run(`pub-${s.id}`, () => publishDraft(actor, s), `Versão ${next} publicada.`);
  };
  const remove = async (s) => {
    if (!(await confirm({ title: `Excluir o rascunho ${s.name}?`, message: 'Só rascunhos nunca publicados podem ser excluídos.', confirmLabel: 'Excluir', danger: true }))) return;
    await run(`del-${s.id}`, () => deleteDraft(actor, s), 'Rascunho excluído.');
  };
  const assign = async (studentId, version) => {
    const student = students.find((x) => x.userId === studentId);
    const ok = await run('assign', () => assignVersion(actor, { academyId, studentId, seriesId: assigning.id, version, teacherId: student?.teacherId || '' }), 'Ficha atribuída.');
    if (ok) setAssigning(null);
  };

  if (error) return <div className={pageCls}><ErrorState onRetry={load} /></div>;
  if (membership === undefined) return <div className={pageCls}><PageSkeleton /></div>;
  if (!membership || !['owner', 'admin', 'teacher'].includes(membership.role)) {
    return <div className={pageCls}><div className="mx-auto max-w-3xl"><EmptyState title="Sem acesso às fichas desta academia" description="Apenas dono, administradores e professores veem as fichas." action={<Link to="/academia" className={btnGhost}>Voltar</Link>} /></div></div>;
  }

  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/academia" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Minha academia</Link>
        <PageHeader eyebrow="Academia" title="Fichas" subtitle="Cada ficha tem um rascunho e versões publicadas que nunca mudam. O aluno fica com a versão que você atribuiu."
          actions={canAuthor && <button type="button" onClick={() => setEditor('new')} className={btnPrimary}><Plus className="h-4 w-4" aria-hidden="true" />Nova ficha</button>} />
        {!canAuthor && <p className="rounded-2xl bg-amber-500/10 p-3 text-sm text-gray-800 dark:text-gray-200">Você pode ver as fichas e atribuir versões aos seus alunos. Para criar ou editar, peça a permissão ao proprietário.</p>}
        {series.length === 0 && <EmptyState title="Nenhuma ficha ainda" description={canAuthor ? 'Crie a primeira ficha como rascunho e publique quando estiver pronta.' : 'A equipe ainda não criou fichas.'} />}
        {series.map((s) => {
          const vs = versionsOf(s.id);
          const latest = vs[0] || null;
          const changed = draftChanged(s, latest);
          return (
            <article key={s.id} className="surface bg-white p-5 dark:bg-gray-900" aria-label={`Ficha ${s.name}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">{s.name}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {s.currentVersion === 0 ? 'Rascunho (nunca publicada)' : `Publicada: versão ${s.currentVersion}`}
                    {s.currentVersion > 0 && changed ? ' · rascunho com alterações' : ''}
                    {` · ${s.draft?.exercises?.length || 0} exercícios no rascunho`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canAuthor && <button type="button" onClick={() => setEditor(s)} className={btnGhost}>Editar rascunho</button>}
                  {canAuthor && changed && (s.draft?.exercises?.length || 0) >= 1 && <button type="button" disabled={busy === `pub-${s.id}`} onClick={() => publish(s)} className={btnPrimary}>Publicar versão {(s.currentVersion || 0) + 1}</button>}
                  {canAuthor && s.currentVersion === 0 && <button type="button" onClick={() => remove(s)} className={btnDanger}><Trash2 className="h-4 w-4" aria-hidden="true" />Excluir</button>}
                  {vs.length > 0 && <button type="button" onClick={() => setAssigning(s)} className={btnGhost}>Atribuir</button>}
                </div>
              </div>
              {vs.length > 0 && (
                <ul className="mt-3 space-y-1.5" aria-label="Versões publicadas">
                  {vs.map((v) => {
                    const n = counts[versionIdOf(s.id, v.version)] || 0;
                    return (
                      <li key={v.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2 text-sm dark:bg-white/5">
                        <span className="font-semibold text-gray-900 dark:text-white">Versão {v.version} · {v.exercises?.length || 0} exercícios</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400" data-testid={`uso-${v.id}`}>{n} {n === 1 ? 'aluno usa' : 'alunos usam'}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
        {!isStaff && <p className="text-xs text-gray-600 dark:text-gray-400">As contagens mostram apenas os alunos sob a sua responsabilidade.</p>}
      </div>
      {editor && <DraftEditor series={editor === 'new' ? null : editor} library={library} busy={busy === 'save'} onClose={() => setEditor(null)} onSave={save} />}
      {assigning && <AssignModal series={assigning} versions={versions} students={students} busy={busy === 'assign'} onClose={() => setAssigning(null)} onAssign={assign} />}
    </div>
  );
}
