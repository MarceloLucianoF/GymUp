import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Dumbbell, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { useAuthContext } from '../../hooks/AuthContext';
import { MY_EXERCISE_GROUPS, deleteMyExercise, listMyExercises, saveMyExercise, updateMyExercise } from '../../services/myExercises';
import { EQUIPMENT, EQUIPMENT_LABELS } from '../../utils/equipment';
import { KIND_LABELS, defaultsForKind, prescriptionLabel, repsFieldLabel, repsPlaceholder } from '../../utils/exerciseKind';
import { ImageError, isSafePhoto, IMAGE_LIMITS, prepareImage } from '../../utils/imageAttach';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const EMPTY = { name: '', kind: 'strength', muscleGroup: 'peito', equipment: 'livre', ...defaultsForKind('strength'), note: '', photo: null };
const groupLabel = (g) => (MY_EXERCISE_GROUPS.find(([k]) => k === g) || [g, g])[1];

function ExerciseForm({ initial, onSave, onClose, busy }) {
  useBodyScrollLock();
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const kind = f.kind;
  const attach = async (file, el) => {
    if (!file) return;
    try { const photo = await prepareImage(file, 'exercise'); setF((x) => ({ ...x, photo })); } catch (error) { toast.error(error instanceof ImageError ? error.message : 'Não consegui usar esta imagem.'); }
    if (el) el.value = '';
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/85 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={initial.docId ? 'Editar exercício' : 'Novo exercício'}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-5 text-gray-900 dark:bg-[#111827] dark:text-white sm:rounded-3xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">{initial.docId ? 'Editar exercício' : 'Novo exercício'}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full bg-gray-100 dark:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <label className="block text-sm font-bold">Nome
          <input value={f.name} onChange={set('name')} maxLength={80} required minLength={2} className="mt-1 w-full input-brand-dark text-base" placeholder="Ex.: Remada no banco do condomínio" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold">Grupo muscular
            <select value={f.muscleGroup} onChange={set('muscleGroup')} className="mt-1 w-full input-brand-dark text-base">{MY_EXERCISE_GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="block text-xs font-bold">Equipamento
            <select value={f.equipment} onChange={set('equipment')} className="mt-1 w-full input-brand-dark text-base">{EQUIPMENT.map((k) => <option key={k} value={k}>{EQUIPMENT_LABELS[k]}</option>)}</select>
          </label>
        </div>
        <label className="block text-xs font-bold">Tipo
          <select value={kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value, ...defaultsForKind(e.target.value) }))} className="mt-1 w-full input-brand-dark text-base">{Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <div className={`grid gap-2 text-xs font-bold ${kind === 'cardio' ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {kind !== 'cardio' && <label>Séries<input type="number" min="1" max="12" inputMode="numeric" value={f.sets} onChange={set('sets')} className="mt-1 w-full input-brand-dark text-base" /></label>}
          <label>{repsFieldLabel(kind)}<input value={f.reps} onChange={set('reps')} placeholder={repsPlaceholder(kind)} className="mt-1 w-full input-brand-dark text-base" /></label>
          {kind !== 'cardio' && <label>Descanso (s)<input type="number" min="0" max="600" inputMode="numeric" value={f.rest} onChange={set('rest')} className="mt-1 w-full input-brand-dark text-base" /></label>}
        </div>
        <label className="block text-xs font-bold">Anotação (opcional)
          <input value={f.note} onChange={set('note')} maxLength={160} className="mt-1 w-full input-brand-dark text-base" placeholder="Ex.: banco na posição 3" />
        </label>
        <div>
          <p className="text-xs font-bold">Foto do exercício (opcional)</p>
          <div className="mt-1 flex items-center gap-3">
            {f.photo ? <img src={f.photo} alt="Foto do exercício" className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/10"><ImagePlus className="h-5 w-5" aria-hidden="true" /></div>}
            <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-2xl bg-gray-100 px-4 text-sm font-bold dark:bg-white/10">{f.photo ? 'Trocar foto' : 'Anexar foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Foto do exercício" onChange={(e) => attach(e.target.files?.[0], e.target)} />
            </label>
            {f.photo && <button type="button" onClick={() => setF((x) => ({ ...x, photo: null }))} className="min-h-[44px] rounded-2xl px-3 text-sm font-bold text-red-700 dark:text-red-300">Remover</button>}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-[48px] flex-1 rounded-2xl bg-gray-100 font-bold dark:bg-white/10">Cancelar</button>
          <button type="submit" disabled={busy || f.name.trim().length < 2} className="btn-primary-gradient min-h-[48px] flex-[2] font-black disabled:opacity-50">{busy ? 'Salvando...' : 'Salvar exercício'}</button>
        </div>
      </form>
    </div>
  );
}

export default function MyExercisesPage() {
  const { user } = useAuthContext();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try { setList(await listMyExercises(user.uid)); } catch (error) { console.error(error); setList([]); toast.error('Não consegui carregar seus exercícios.'); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const save = async (f) => {
    setBusy(true);
    try {
      if (f.docId) await updateMyExercise(user.uid, f.docId, f); else await saveMyExercise(user.uid, f);
      toast.success('Exercício salvo.');
      setForm(null);
      await load();
    } catch (error) { console.error(error); toast.error('Não consegui salvar o exercício.'); }
    setBusy(false);
  };
  const remove = async (e) => {
    if (!window.confirm(`Apagar "${e.name}"? Os treinos que já usam este exercício continuam com a cópia deles.`)) return;
    try { await deleteMyExercise(user.uid, e.docId); toast.success('Exercício apagado.'); await load(); } catch { toast.error('Não consegui apagar.'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 sm:p-6 pb-32">
      <div className="max-w-3xl mx-auto">
        <Link to="/trainings" className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-gray-700 dark:text-gray-300"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Fichas de treino</Link>
        <PageHeader
          eyebrow="Só você vê"
          title="Meus exercícios"
          subtitle="Exercícios que você criou e usa nos seus treinos, com foto se quiser."
          actions={<button type="button" onClick={() => setForm({ ...EMPTY })} className="btn-primary-gradient pressable min-h-[44px] px-4 text-xs font-black shrink-0"><Plus className="w-4 h-4" aria-hidden="true" />Novo exercício</button>}
        />
        {list === null ? (
          <p className="text-gray-600 dark:text-gray-300" role="status">Carregando...</p>
        ) : list.length === 0 ? (
          <div className="surface p-6 text-center">
            <Dumbbell className="mx-auto mb-2 h-8 w-8 text-brand" aria-hidden="true" />
            <p className="font-bold text-gray-900 dark:text-white">Você ainda não criou exercícios</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Crie o movimento que a sua academia tem e que não está na biblioteca. Ele aparece na busca ao montar um treino.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((e) => (
              <li key={e.id} className="surface flex items-center gap-3 p-3">
                {isSafePhoto(e.photo, IMAGE_LIMITS.exercise.maxChars) ? <img src={e.photo} alt={e.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/10"><Dumbbell className="h-6 w-6" aria-hidden="true" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-900 dark:text-white">{e.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{groupLabel(e.muscleGroup)} · {EQUIPMENT_LABELS[e.equipment]?.split(' (')[0].split(',')[0] || e.equipment} · {prescriptionLabel(e)}</p>
                  {e.note && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{e.note}</p>}
                </div>
                <button type="button" onClick={() => setForm({ ...EMPTY, ...e })} aria-label={`Editar ${e.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-white/10"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" onClick={() => remove(e)} aria-label={`Apagar ${e.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {form && <ExerciseForm initial={form} onSave={save} onClose={() => setForm(null)} busy={busy} />}
    </div>
  );
}
