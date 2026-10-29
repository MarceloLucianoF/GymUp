import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import SetPlanEditor from './SetPlanEditor';
import { assignSupersetLetters, hasPlan, normalizeSetTypes, supersetLinks } from '../../utils/setTypes';
import { ArrowDown, ArrowUp, FileText, ImagePlus, Loader2, PencilLine, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { exercises as LIBRARY } from '../../data/exercises';
import { askWorkoutImport } from '../../services/aiService';
import { saveMyWorkout, updateMyWorkout } from '../../services/myWorkouts';
import { myExerciseToLibrary } from '../../services/myExercises';
import { ImageError, isSafePhoto, prepareImage } from '../../utils/imageAttach';
import { KIND_LABELS, cardioMinutes, defaultsForKind, exerciseKind, repsFieldLabel, repsPlaceholder } from '../../utils/exerciseKind';
import { IMPORT_LIMITS, ImportError, buildImportMessages, extractPdfText, matchLibrary, mergeImported, parseImportedWorkout, parseLocalSection, splitWorkoutSections, sanitizeDocumentText, toWorkoutExercise } from '../../services/workoutImport';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const blank = (name, ref = null) => {
  const kind = exerciseKind({ name, muscleGroup: ref?.muscleGroup, kind: ref?.kind });
  const d = defaultsForKind(kind);
  // exercício meu traz a prescrição que o aluno definiu; o da biblioteca começa com o padrão do tipo
  return { key: newKey(), name, kind, setTypes: null, link: false, ...d, ...(ref?.mine ? { sets: String(ref.sets || d.sets), reps: String(ref.reps || d.reps), rest: ref.rest ?? d.rest } : {}), note: ref?.mine ? ref.description || '' : '', photo: ref?.mine ? ref.machineImage : null, ref };
};

// Exercício já salvo na ficha -> linha do editor. Só o que veio da biblioteca ou dos exercícios do aluno mantém o vínculo (imagem e texto).
const fromSaved = (ex) => {
  const kind = exerciseKind(ex);
  const linked = ex.firestoreId && !String(ex.firestoreId).startsWith('custom-');
  const custom = !linked;
  return {
    key: newKey(), name: ex.name || '', kind, sets: String(ex.sets ?? defaultsForKind(kind).sets),
    reps: kind === 'cardio' ? String(cardioMinutes(ex)) : String(ex.reps ?? defaultsForKind(kind).reps), rest: kind === 'cardio' ? 0 : (ex.rest ?? defaultsForKind(kind).rest),
    note: ex.note || '', photo: custom && isSafePhoto(ex.machineImage, 45000) ? ex.machineImage : null,
    setTypes: Array.isArray(ex.setTypes) ? ex.setTypes : null, link: false,
    ref: linked ? { ...ex, id: ex.firestoreId, mine: String(ex.firestoreId).startsWith('mine_') } : null
  };
};

export default function MyWorkoutModal({ isOpen, onClose, user, library = LIBRARY, myExercises = [], editing = null, onSaved }) {
  useBodyScrollLock(isOpen);
  const [step, setStep] = useState('choose');
  const [sections, setSections] = useState([]);   // PDF com vários treinos (A, B, C)
  const [sectionNote, setSectionNote] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [source, setSource] = useState('manual');
  const [photo, setPhoto] = useState(null);
  const [query, setQuery] = useState('');
  const fileRef = useRef(null);
  const photoRef = useRef(null);

  // Abrir em modo de edição: carrega o treino salvo direto na tela de revisão.
  useEffect(() => {
    if (!isOpen || !editing) return;
    setName(editing.workout.name || '');
    const saved = editing.workout.exercises || [];
    const links = supersetLinks(saved);
    setItems(saved.map((ex, i) => ({ ...fromSaved(ex), link: links[i] })));
    setPhoto(isSafePhoto(editing.workout.photo) ? editing.workout.photo : null);
    setSource(editing.workout.source || 'manual');
    setWarnings([]); setQuery(''); setBusy(''); setStep('edit');
  }, [isOpen, editing]);

  const mineAsLibrary = useMemo(() => myExercises.map(myExerciseToLibrary), [myExercises]);
  const suggestions = useMemo(() => {
    const q = plain(query).trim();
    if (q.length < 2) return [];
    const hit = (e) => plain(e.name).includes(q);
    return [...mineAsLibrary.filter(hit), ...library.filter(hit)].slice(0, 7);
  }, [query, library, mineAsLibrary]);

  if (!isOpen) return null;

  const reset = () => { setSections([]); setReviewing(null); setStep('choose'); setName(''); setItems([]); setWarnings([]); setQuery(''); setSource('manual'); setPhoto(null); setBusy(''); };
  const close = () => { reset(); onClose(); };
  const startManual = () => { setSource('manual'); setName('Meu treino'); setItems([]); setStep('edit'); };

  // Executa as tarefas com no máximo `limit` ao mesmo tempo; devolve { ok, value | error } na ordem original.
  const runPool = async (items, fn, limit) => {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => { while (next < items.length) { const i = next++; try { out[i] = { ok: true, value: await fn(items[i]) }; } catch (error) { out[i] = { ok: false, error }; } } };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  };

  const importPdf = async (file) => {
    if (!file) return;
    setBusy('Lendo o PDF no seu aparelho...');
    try {
      const { text: raw, truncatedPages } = await extractPdfText(file);
      const { text, removed } = sanitizeDocumentText(raw);
      if (text.length < 20) throw new ImportError('sem_texto', 'Não encontrei texto útil neste PDF. Monte o treino manualmente.');
      setBusy('A IA está montando o treino (pode levar até 1 minuto)...');
      // Ficha com vários treinos: uma chamada por treino, em paralelo (de uma vez a IA passava do tempo).
      // Cada treino da ficha: primeiro a leitura local (instantânea, sem IA); só o que ela não reconhece vai para a IA,
      // no máximo 2 ao mesmo tempo (mais que isso o provedor trava), 55 s por parte e uma nova tentativa da que falhar.
      const parts = splitWorkoutSections(text);
      const results = parts.map((part) => { const local = parseLocalSection(part); try { return local ? { ok: true, value: parseImportedWorkout(JSON.stringify(local), library), local: true } : null; } catch (_) { return null; } });
      const needAi = results.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
      if (needAi.length) {
        setBusy('A IA está montando o treino (pode levar até 1 minuto)...');
        const one = (part) => askWorkoutImport(buildImportMessages(part), { timeoutMs: parts.length > 1 ? 55000 : 90000 }).then((reply) => parseImportedWorkout(reply, library));
        const first = await runPool(needAi.map((i) => parts[i]), one, 2);
        needAi.forEach((i, k) => { results[i] = first[k]; });
        const failed = results.map((r, i) => (r.ok ? -1 : i)).filter((i) => i >= 0);
        if (failed.length && failed.length < parts.length) {
          setBusy('Quase lá: lendo de novo uma parte do documento...');
          const again = await runPool(failed.map((i) => parts[i]), one, 2);
          failed.forEach((i, k) => { if (again[k].ok) results[i] = again[k]; });
        }
      }
      const done = results.filter((r) => r.ok).map((r) => r.value);
      if (!done.length) throw results[0].error;
      const missing = results.filter((r) => !r.ok).length;
      if (done.length > 1) {   // vários treinos (A, B, C): escolher salvar todos ou revisar um por um
        setSections(done.map((d, i) => ({ id: i, name: d.name || `Treino ${String.fromCharCode(65 + i)}`, exercises: d.exercises, warnings: d.warnings, selected: true, saved: false })));
        setSectionNote(missing ? `A IA não conseguiu ler ${missing} de ${parts.length} partes do documento. Confira se faltou algum treino.` : '');
        setSource('pdf');
        setStep('sections');
        return;
      }
      const parsed = mergeImported(done);
      if (missing) parsed.warnings.push(`A IA não conseguiu ler ${missing} de ${parts.length} partes do documento. Confira se faltou algum treino e complete à mão.`);
      const notes = [...parsed.warnings];
      if (removed.links || removed.contacts) notes.push('Links, e-mails e telefones do documento foram ignorados por segurança.');
      if (removed.suspicious) notes.push('Trechos suspeitos do documento (pedidos de pagamento ou instruções para a IA) foram ignorados.');
      if (removed.truncated || truncatedPages) notes.push(`Só o começo do documento foi lido (até ${IMPORT_LIMITS.maxPages} páginas).`);
      setName(parsed.name);
      setItems(parsed.exercises.map((e) => ({ ...blank(e.name, e.ref), kind: e.kind, setTypes: e.setTypes || null, sets: e.kind === 'cardio' ? '1' : e.sets, reps: e.kind === 'cardio' ? String(e.durationMin) : e.kind === 'timed' ? String(e.seconds) : e.reps, rest: e.kind === 'cardio' ? 0 : e.rest, note: e.note })));
      setWarnings(notes);
      setSource('pdf');
      setStep('edit');
    } catch (error) {
      const slow = /504|AbortError|aborted|tempo/i.test(`${error?.name} ${error?.message}`);
      toast.error(error instanceof ImportError ? error.message : slow ? 'A IA demorou demais para montar o treino. Tente de novo em instantes ou monte o treino manualmente.' : 'Não consegui importar agora. Tente de novo ou monte o treino manualmente.');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toItems = (exercises) => exercises.map((e) => ({ ...blank(e.name, e.ref), kind: e.kind, setTypes: e.setTypes || null, sets: e.kind === 'cardio' ? '1' : e.sets, reps: e.kind === 'cardio' ? String(e.durationMin) : e.kind === 'timed' ? String(e.seconds) : e.reps, rest: e.kind === 'cardio' ? 0 : e.rest, note: e.note }));
  const reviewSection = (sec) => { setReviewing(sec.id); setName(sec.name); setItems(toItems(sec.exercises)); setWarnings(sec.warnings || []); setStep('edit'); };
  const saveSections = async () => {
    const chosen = sections.filter((sec) => sec.selected && !sec.saved);
    if (!chosen.length) { toast.error('Escolha ao menos um treino.'); return; }
    setBusy('Salvando...');
    try {
      for (const sec of chosen) {
        const exs = sec.exercises.slice(0, 30).map((e, i) => toWorkoutExercise(e, e.ref, i));
        await saveMyWorkout(user.uid, { name: sec.name.slice(0, 80), exercises: exs, source: 'pdf', photo: null, description: 'Importado de um PDF seu.' });
      }
      toast.success(chosen.length === 1 ? 'Treino salvo em "Meus treinos".' : `${chosen.length} treinos salvos em "Meus treinos".`);
      onSaved?.();
      close();
    } catch (error) {
      console.error(error);
      toast.error('Não consegui salvar os treinos.');
      setBusy('');
    }
  };

  const attach = async (file, kind, apply, inputEl) => {
    if (!file) return;
    try { apply(await prepareImage(file, kind)); } catch (error) { toast.error(error instanceof ImageError ? error.message : 'Não consegui usar esta imagem.'); }
    if (inputEl) inputEl.value = '';
  };

  const patch = (key, changes) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  const move = (index, delta) => setItems((l) => { const j = index + delta; if (j < 0 || j >= l.length) return l; const next = [...l]; [next[index], next[j]] = [next[j], next[index]]; return next; });
  const addFromLibrary = (ex) => { setItems((l) => [...l, blank(ex.name, ex)]); setQuery(''); };
  const addFree = () => { const n = query.trim().slice(0, IMPORT_LIMITS.maxName); if (n.length < 2) return; setItems((l) => [...l, blank(n, matchLibrary(n, [...mineAsLibrary, ...library]))]); setQuery(''); };

  const save = async () => {
    const valid = items.filter((it) => it.name.trim().length > 1);
    if (!valid.length) { toast.error('Adicione ao menos um exercício.'); return; }
    setBusy('Salvando...');
    try {
      const letters = assignSupersetLetters(valid.slice(0, 30).map((it) => it.link));
      const exs = valid.slice(0, 30).map((it, i) => toWorkoutExercise({
        name: it.name.trim().slice(0, IMPORT_LIMITS.maxName), kind: it.kind, photo: it.ref ? null : it.photo, durationMin: Math.min(180, Math.max(1, parseInt(it.reps, 10) || 20)), seconds: Math.min(600, Math.max(1, parseInt(it.reps, 10) || 30)), sets: Math.min(10, Math.max(1, Number(it.sets) || 3)), reps: String(it.reps || '10').slice(0, 12), rest: Math.min(600, Math.max(0, Number(it.rest) || 0)), note: it.note,
        setTypes: hasPlan(it.setTypes) ? normalizeSetTypes(it.setTypes, Math.min(10, Math.max(1, Number(it.sets) || 3))) : null, superset: letters[i]
      }, it.ref, i));
      if (editing) {
        await updateMyWorkout(user.uid, editing.docId, { name, exercises: exs, source, photo, createdAt: editing.workout.createdAt, description: editing.workout.description });
        toast.success('Treino atualizado.');
      } else {
        await saveMyWorkout(user.uid, { name, exercises: exs, source, photo, description: source === 'pdf' ? 'Importado de um PDF seu.' : 'Montado por você.' });
        toast.success('Treino salvo em "Meus treinos".');
      }
      onSaved?.();
      if (reviewing !== null && sections.some((sec) => !sec.saved && sec.id !== reviewing)) {   // volta à lista dos treinos do PDF
        setSections((list) => list.map((sec) => (sec.id === reviewing ? { ...sec, saved: true } : sec)));
        setReviewing(null); setBusy(''); setStep('sections');
        return;
      }
      close();
    } catch (error) {
      console.error(error);
      toast.error('Não consegui salvar o treino.');
      setBusy('');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/85 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={editing ? 'Editar meu treino' : 'Meu treino'}>
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-5 text-gray-900 dark:bg-[#111827] dark:text-white sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">{editing ? 'Editar meu treino' : step === 'choose' ? 'Cadastrar meu treino' : step === 'sections' ? 'Treinos do PDF' : 'Revise seu treino'}</h2>
          <button type="button" onClick={close} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full bg-gray-100 dark:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        {step === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">Seu treino fica só com você: não aparece na loja de fichas para outros alunos.</p>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" id="my-workout-pdf" onChange={(e) => importPdf(e.target.files?.[0])} disabled={!!busy} />
            <label htmlFor="my-workout-pdf" className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl bg-brand/10 p-4 font-bold ${busy ? 'opacity-60' : ''}`}>
              {busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <FileText className="h-6 w-6" aria-hidden="true" />}
              <span>{busy || 'Importar de um PDF'}<span className="block text-sm font-normal text-gray-600 dark:text-gray-300">O app lê a ficha (e a IA ajuda quando o formato é diferente) para você revisar.</span></span>
            </label>
            <button type="button" onClick={startManual} disabled={!!busy} className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-gray-100 p-4 text-left font-bold dark:bg-white/10">
              <PencilLine className="h-6 w-6" aria-hidden="true" />
              <span>Montar do zero<span className="block text-sm font-normal text-gray-600 dark:text-gray-300">Escolha os exercícios da biblioteca ou digite os seus.</span></span>
            </button>
            <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />O PDF é lido no seu aparelho e não é guardado. Só o texto, sem links, e-mails e telefones, vai para a IA. Nada do documento é aberto ou executado.</p>
          </div>
        )}

        {step === 'sections' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-200">Encontrei <b>{sections.length} treinos</b> neste PDF. Salve todos de uma vez ou revise um por um.</p>
            {sectionNote && <p className="rounded-2xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" role="status">{sectionNote}</p>}
            <ul className="space-y-2">
              {sections.map((sec) => (
                <li key={sec.id} className="flex items-center gap-3 rounded-2xl bg-gray-100 p-3 dark:bg-white/5">
                  <input type="checkbox" checked={sec.selected && !sec.saved} disabled={sec.saved} onChange={(e) => setSections((l) => l.map((x) => (x.id === sec.id ? { ...x, selected: e.target.checked } : x)))} className="h-5 w-5 accent-brand" aria-label={`Incluir ${sec.name}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{sec.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{sec.saved ? 'Salvo' : `${sec.exercises.length} exercícios`}</p>
                  </div>
                  {!sec.saved && <button type="button" onClick={() => reviewSection(sec)} className="min-h-[44px] rounded-xl px-3 text-sm font-bold text-amber-800 dark:text-brand">Revisar</button>}
                </li>
              ))}
            </ul>
            <button type="button" onClick={saveSections} disabled={!!busy} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-black text-black disabled:opacity-60">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
              {busy || `Salvar ${sections.filter((x) => x.selected && !x.saved).length} treinos`}
            </button>
          </div>
        )}

        {step === 'edit' && (
          <div className="space-y-4">
            {warnings.length > 0 && (
              <ul className="space-y-1 rounded-2xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" role="status">
                {warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            <label className="block text-sm font-bold">Nome do treino
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className="mt-1 w-full input-brand-dark text-base" maxLength={80} />
            </label>
            <div>
              <p className="text-sm font-bold">Foto do treino (opcional)</p>
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="my-workout-photo" onChange={(e) => attach(e.target.files?.[0], 'workout', setPhoto, e.target)} />
              <div className="mt-1 flex items-center gap-3">
                {photo ? <img src={photo} alt="Foto do treino" className="h-20 w-20 rounded-2xl object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-white/10"><ImagePlus className="h-6 w-6" aria-hidden="true" /></div>}
                <div className="flex flex-col gap-2">
                  <label htmlFor="my-workout-photo" className="inline-flex min-h-[44px] cursor-pointer items-center rounded-2xl bg-gray-100 px-4 text-sm font-bold dark:bg-white/10">{photo ? 'Trocar foto' : 'Anexar foto'}</label>
                  {photo && <button type="button" onClick={() => setPhoto(null)} className="min-h-[44px] rounded-2xl px-4 text-sm font-bold text-red-700 dark:text-red-300">Remover foto</button>}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Pode ser a foto da sua ficha no papel. A imagem é reduzida no seu aparelho e fica só com você.</p>
            </div>
            <ul className="space-y-3">
              {items.map((it, index) => (
                <li key={it.key} className="rounded-2xl bg-gray-100 p-3 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    <div className="flex shrink-0 flex-col gap-1">
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir ${it.name}`} className="grid h-8 w-9 place-items-center rounded-lg bg-white text-gray-700 disabled:opacity-30 dark:bg-white/10 dark:text-gray-200"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Descer ${it.name}`} className="grid h-8 w-9 place-items-center rounded-lg bg-white text-gray-700 disabled:opacity-30 dark:bg-white/10 dark:text-gray-200"><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                    <input value={it.name} onChange={(e) => patch(it.key, { name: e.target.value.slice(0, IMPORT_LIMITS.maxName), ref: null, ...(exerciseKind({ name: e.target.value }) !== it.kind ? { kind: exerciseKind({ name: e.target.value }), ...defaultsForKind(exerciseKind({ name: e.target.value })) } : {}) })} aria-label="Nome do exercício" className="min-w-0 flex-1 input-brand-dark text-base font-bold" />
                    <button type="button" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))} aria-label={`Remover ${it.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{it.ref ? (it.ref.mine ? 'Um dos seus exercícios.' : 'Na biblioteca: terá imagem e explicação.') : 'Fora da biblioteca: sem imagem de demonstração, a não ser que você anexe uma.'}</p>
                  {!it.ref && (
                    <div className="mt-2 flex items-center gap-3">
                      {it.photo && <img src={it.photo} alt={`Foto de ${it.name}`} className="h-14 w-14 rounded-xl object-cover" />}
                      <label className="inline-flex min-h-[40px] cursor-pointer items-center rounded-xl bg-white px-3 text-xs font-bold dark:bg-white/10">
                        <ImagePlus className="mr-1 h-4 w-4" aria-hidden="true" />{it.photo ? 'Trocar foto' : 'Foto do exercício'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Foto de ${it.name}`} onChange={(e) => attach(e.target.files?.[0], 'exercise', (url) => patch(it.key, { photo: url }), e.target)} />
                      </label>
                      {it.photo && <button type="button" onClick={() => patch(it.key, { photo: null })} className="min-h-[40px] rounded-xl px-2 text-xs font-bold text-red-700 dark:text-red-300">Remover</button>}
                    </div>
                  )}
                  <label className="mt-2 block text-xs font-bold">Tipo
                    <select value={it.kind} onChange={(e) => patch(it.key, { kind: e.target.value, ...defaultsForKind(e.target.value) })} className="mt-1 w-full input-brand-dark text-base">
                      {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </label>
                  {it.kind === 'strength' && (
                    <SetPlanEditor idBase={`plan-${it.key}`} sets={it.sets} types={it.setTypes} onTypes={(t) => patch(it.key, { setTypes: t })} link={it.link} onLink={(v) => patch(it.key, { link: v })} canLink={index < items.length - 1} />
                  )}
                  {it.kind === 'cardio' ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold">
                      <label>{repsFieldLabel('cardio')}<input type="number" inputMode="numeric" min="1" max="180" value={it.reps} onChange={(e) => patch(it.key, { reps: e.target.value })} className="mt-1 w-full input-brand-dark text-base" /></label>
                      <label>Intensidade<input value={it.note} onChange={(e) => patch(it.key, { note: e.target.value.slice(0, IMPORT_LIMITS.maxNote) })} placeholder="ex.: leve, moderado" className="mt-1 w-full input-brand-dark text-base" /></label>
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold">
                      <label>Séries<input type="number" inputMode="numeric" min="1" max="10" value={it.sets} onChange={(e) => patch(it.key, { sets: e.target.value })} className="mt-1 w-full input-brand-dark text-base" /></label>
                      <label>{repsFieldLabel(it.kind)}<input value={it.reps} onChange={(e) => patch(it.key, { reps: e.target.value.slice(0, 12) })} placeholder={repsPlaceholder(it.kind)} className="mt-1 w-full input-brand-dark text-base" /></label>
                      <label>Descanso (s)<input type="number" inputMode="numeric" min="0" max="600" value={it.rest} onChange={(e) => patch(it.key, { rest: e.target.value })} className="mt-1 w-full input-brand-dark text-base" /></label>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div>
              <label className="block text-sm font-bold" htmlFor="my-ex-search">Adicionar exercício</label>
              <div className="mt-1 flex gap-2">
                <input id="my-ex-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFree(); } }} placeholder="Busque na biblioteca ou digite o seu" className="min-w-0 flex-1 input-brand-dark text-base" />
                <button type="button" onClick={addFree} disabled={query.trim().length < 2} aria-label="Adicionar o que digitei" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-black disabled:opacity-40"><Plus className="h-5 w-5" aria-hidden="true" /></button>
              </div>
              {suggestions.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {suggestions.map((s) => <li key={s.id}><button type="button" onClick={() => addFromLibrary(s)} className="flex w-full items-center justify-between rounded-xl bg-gray-100 p-3 text-left text-sm font-bold dark:bg-white/10">{s.name}{s.mine && <span className="ml-2 rounded-full bg-brand/20 px-2 py-0.5 text-[11px] text-amber-800 dark:text-brand">meu</span>}</button></li>)}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={editing ? close : reset} disabled={!!busy} className="min-h-[48px] flex-1 rounded-2xl bg-gray-100 font-bold dark:bg-white/10">{editing ? 'Cancelar' : 'Voltar'}</button>
              <button type="button" onClick={save} disabled={!!busy || items.length === 0} className="btn-primary-gradient min-h-[48px] flex-[2] font-black disabled:opacity-50">{busy || (editing ? 'Salvar alterações' : 'Salvar em Meus treinos')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
