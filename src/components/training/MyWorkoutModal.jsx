import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Loader2, PencilLine, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { exercises as LIBRARY } from '../../data/exercises';
import { askWorkoutImport } from '../../services/aiService';
import { saveMyWorkout } from '../../services/myWorkouts';
import { IMPORT_LIMITS, ImportError, buildImportMessages, extractPdfText, matchLibrary, parseImportedWorkout, sanitizeDocumentText, toWorkoutExercise } from '../../services/workoutImport';

const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const blank = (name, ref = null) => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, sets: 3, reps: '10', rest: 60, note: '', ref });

export default function MyWorkoutModal({ isOpen, onClose, user, library = LIBRARY, onSaved }) {
  const [step, setStep] = useState('choose');
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [source, setSource] = useState('manual');
  const [query, setQuery] = useState('');
  const fileRef = useRef(null);

  const suggestions = useMemo(() => {
    const q = plain(query).trim();
    if (q.length < 2) return [];
    return library.filter((e) => plain(e.name).includes(q)).slice(0, 6);
  }, [query, library]);

  if (!isOpen) return null;

  const reset = () => { setStep('choose'); setName(''); setItems([]); setWarnings([]); setQuery(''); setSource('manual'); setBusy(''); };
  const close = () => { reset(); onClose(); };

  const startManual = () => { setSource('manual'); setName('Meu treino'); setItems([]); setStep('edit'); };

  const importPdf = async (file) => {
    if (!file) return;
    setBusy('Lendo o PDF no seu aparelho...');
    try {
      const { text: raw, truncatedPages } = await extractPdfText(file);
      const { text, removed } = sanitizeDocumentText(raw);
      if (text.length < 20) throw new ImportError('sem_texto', 'Não encontrei texto útil neste PDF. Monte o treino manualmente.');
      setBusy('A IA está montando o treino...');
      const reply = await askWorkoutImport(buildImportMessages(text));
      const parsed = parseImportedWorkout(reply, library);
      const notes = [...parsed.warnings];
      if (removed.links || removed.contacts) notes.push('Links, e-mails e telefones do documento foram ignorados por segurança.');
      if (removed.suspicious) notes.push('Trechos suspeitos do documento (pedidos de pagamento ou instruções para a IA) foram ignorados.');
      if (removed.truncated || truncatedPages) notes.push(`Só o começo do documento foi lido (até ${IMPORT_LIMITS.maxPages} páginas).`);
      setName(parsed.name);
      setItems(parsed.exercises.map((e) => ({ ...blank(e.name, e.ref), sets: e.sets, reps: e.reps, rest: e.rest, note: e.note })));
      setWarnings(notes);
      setSource('pdf');
      setStep('edit');
    } catch (error) {
      toast.error(error instanceof ImportError ? error.message : 'Não consegui importar agora. Tente de novo ou monte o treino manualmente.');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const patch = (key, changes) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  const addFromLibrary = (ex) => { setItems((l) => [...l, blank(ex.name, ex)]); setQuery(''); };
  const addFree = () => { const n = query.trim().slice(0, IMPORT_LIMITS.maxName); if (n.length < 2) return; setItems((l) => [...l, blank(n, matchLibrary(n, library))]); setQuery(''); };

  const save = async () => {
    const valid = items.filter((it) => it.name.trim().length > 1);
    if (!valid.length) { toast.error('Adicione ao menos um exercício.'); return; }
    setBusy('Salvando...');
    try {
      const exs = valid.slice(0, 30).map((it, i) => toWorkoutExercise({
        name: it.name.trim().slice(0, IMPORT_LIMITS.maxName), sets: Math.min(10, Math.max(1, Number(it.sets) || 3)), reps: String(it.reps || '10').slice(0, 12), rest: Math.min(600, Math.max(0, Number(it.rest) || 0)), note: it.note
      }, it.ref, i));
      await saveMyWorkout(user.uid, { name, exercises: exs, source, description: source === 'pdf' ? 'Importado de um PDF seu.' : 'Montado por você.' });
      toast.success('Treino salvo em "Meus treinos".');
      onSaved?.();
      close();
    } catch (error) {
      console.error(error);
      toast.error('Não consegui salvar o treino.');
      setBusy('');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/85 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Meu treino">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-5 text-gray-900 dark:bg-[#111827] dark:text-white sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">{step === 'choose' ? 'Cadastrar meu treino' : 'Revise seu treino'}</h2>
          <button type="button" onClick={close} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full bg-gray-100 dark:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        {step === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">Seu treino fica só com você: não aparece na loja de fichas para outros alunos.</p>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" id="my-workout-pdf" onChange={(e) => importPdf(e.target.files?.[0])} disabled={!!busy} />
            <label htmlFor="my-workout-pdf" className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl bg-brand/10 p-4 font-bold ${busy ? 'opacity-60' : ''}`}>
              {busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <FileText className="h-6 w-6" aria-hidden="true" />}
              <span>{busy || 'Importar de um PDF'}<span className="block text-sm font-normal text-gray-600 dark:text-gray-300">A IA lê o documento e monta a ficha para você revisar.</span></span>
            </label>
            <button type="button" onClick={startManual} disabled={!!busy} className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-gray-100 p-4 text-left font-bold dark:bg-white/10">
              <PencilLine className="h-6 w-6" aria-hidden="true" />
              <span>Montar do zero<span className="block text-sm font-normal text-gray-600 dark:text-gray-300">Escolha os exercícios da biblioteca ou digite os seus.</span></span>
            </button>
            <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />O PDF é lido no seu aparelho e não é guardado. Só o texto, sem links, e-mails e telefones, vai para a IA. Nada do documento é aberto ou executado.</p>
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
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.key} className="rounded-2xl bg-gray-100 p-3 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    <input value={it.name} onChange={(e) => patch(it.key, { name: e.target.value.slice(0, IMPORT_LIMITS.maxName), ref: null })} aria-label="Nome do exercício" className="min-w-0 flex-1 input-brand-dark text-base font-bold" />
                    <button type="button" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))} aria-label={`Remover ${it.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{it.ref ? 'Na biblioteca: terá imagem e explicação.' : 'Fora da biblioteca: sem imagem de demonstração.'}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold">
                    <label>Séries<input type="number" inputMode="numeric" min="1" max="10" value={it.sets} onChange={(e) => patch(it.key, { sets: e.target.value })} className="mt-1 w-full input-brand-dark text-base" /></label>
                    <label>Repetições<input value={it.reps} onChange={(e) => patch(it.key, { reps: e.target.value.slice(0, 12) })} className="mt-1 w-full input-brand-dark text-base" /></label>
                    <label>Descanso (s)<input type="number" inputMode="numeric" min="0" max="600" value={it.rest} onChange={(e) => patch(it.key, { rest: e.target.value })} className="mt-1 w-full input-brand-dark text-base" /></label>
                  </div>
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
                  {suggestions.map((s) => <li key={s.id}><button type="button" onClick={() => addFromLibrary(s)} className="w-full rounded-xl bg-gray-100 p-3 text-left text-sm font-bold dark:bg-white/10">{s.name}</button></li>)}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={reset} disabled={!!busy} className="min-h-[48px] flex-1 rounded-2xl bg-gray-100 font-bold dark:bg-white/10">Voltar</button>
              <button type="button" onClick={save} disabled={!!busy || items.length === 0} className="btn-primary-gradient min-h-[48px] flex-[2] font-black disabled:opacity-50">{busy || 'Salvar em Meus treinos'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
