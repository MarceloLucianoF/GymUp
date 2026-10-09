import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import { useAdmin } from '../../hooks/useAdmin';
import { Navigate } from 'react-router-dom';
import { FileJson, Edit3, Trash2, Check, Save, PlusCircle, CheckCircle, Sparkles, Search, Dumbbell } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import Tabs from '../../components/coach/Tabs';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { btnPrimary, btnGhost, iconBtn, inputCls, labelCls, pageCls } from '../../components/coach/styles';

const MUSCLE_GROUPS = [['peito', 'Peito'], ['costas', 'Costas'], ['pernas', 'Pernas'], ['ombros', 'Ombros'], ['braços', 'Braços'], ['core', 'Core']];

export default function AdminPanel() {
  const { confirm, dialog } = useConfirm();
  const { isAdmin, loading: authLoading } = useAdmin();
  const [activeTab, setActiveTab] = useState('exercises');
  
  const [exercises, setExercises] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pickerTerm, setPickerTerm] = useState('');

  // Estados de Edição
  const [editingId, setEditingId] = useState(null);

  // Forms
  const initialExForm = { name: '', muscleGroup: '', machineImage: '', videoUrl: '', sets: 3, reps: '12', rest: 60, execution: '' };
  const [exForm, setExForm] = useState(initialExForm);
  
  const initialTrainingForm = { name: '', description: '', difficulty: 'Iniciante' };
  const [trainingForm, setTrainingForm] = useState(initialTrainingForm);
  const [selectedExercises, setSelectedExercises] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const exSnap = await getDocs(collection(db, 'exercises'));
      const trSnap = await getDocs(collection(db, 'trainings'));
      
      setExercises(exSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a,b) => String(a.name).localeCompare(String(b.name))));
      setTrainings(trSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  // --- IMPORTAÇÃO INTELIGENTE COM AUTO-RELACIONAMENTO ---
  const handleImportJson = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const loadingToast = toast.loading('Analisando dados...');
      try {
        const jsonData = JSON.parse(event.target.result);
        const targetCollection = activeTab === 'exercises' ? 'exercises' : 'trainings';
        
        let itemsToImport = [];
        if (Array.isArray(jsonData)) {
            itemsToImport = jsonData;
        } else {
            itemsToImport = jsonData[targetCollection] || jsonData.exercises || jsonData.trainings || [jsonData];
        }

        if (!itemsToImport || itemsToImport.length === 0) throw new Error("JSON vazio.");

        // --- PREPARAÇÃO PARA VINCULAR TREINOS ---
        // Se estivermos importando treinos, precisamos buscar os exercícios existentes
        // para converter IDs numéricos (101) em IDs do Firestore (dgzAR...)
        let exerciseMap = {}; 
        if (targetCollection === 'trainings') {
            toast.loading('Vinculando exercícios...', { id: loadingToast });
            const currentExercisesSnap = await getDocs(collection(db, 'exercises'));
            currentExercisesSnap.forEach(doc => {
                const data = doc.data();
                // Cria um mapa: "101" -> "dgzARp3P..."
                if (data.originalId) exerciseMap[String(data.originalId)] = doc.id;
                // Fallback: tenta mapear pelo ID antigo se salvo como string
                if (data.id) exerciseMap[String(data.id)] = doc.id;
            });
        }

        const batch = writeBatch(db);
        let count = 0;

        for (const item of itemsToImport) {
             const docRef = doc(collection(db, targetCollection));
             const docData = {
                 ...item,
                 createdAt: new Date().toISOString(),
                 originalId: item.id ? String(item.id) : null // Salva ID antigo para referência
             };
             
             // Limpeza do ID principal para não conflitar com Firestore
             delete docData.id; 

             // LÓGICA DE EXERCÍCIOS
             if (targetCollection === 'exercises') {
                 if (docData.muscleGroup) docData.muscleGroup = docData.muscleGroup.toLowerCase();
             }

             // LÓGICA DE TREINOS (O PULO DO GATO)
             if (targetCollection === 'trainings' && Array.isArray(item.exercises)) {
                 // Substitui [101, 102] por ["dgz...", "u3u..."]
                 const resolvedExercises = item.exercises.map(oldId => {
                     const realId = exerciseMap[String(oldId)];
                     if (!realId) console.warn(`Aviso: Exercício ID ${oldId} não encontrado no banco.`);
                     return realId || oldId; // Se achar, usa o novo. Se não, mantém o velho (mas vai dar aviso).
                 }).filter(Boolean); // Remove nulos
                 
                 docData.exercises = resolvedExercises;
             }

             batch.set(docRef, docData);
             count++;
        }

        await batch.commit();
        toast.success(`${count} itens importados e vinculados!`, { id: loadingToast });
        fetchData(); // Recarrega tela
      } catch (error) {
        console.error(error);
        toast.error("Erro na importação. Verifique formato.", { id: loadingToast });
      }
    };
    reader.readAsText(file);
  };

  // --- LÓGICA DE EXERCÍCIOS ---
  const handleSaveExercise = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading("Salvando...");
    try {
        const payload = {
            ...exForm,
            sets: Number(exForm.sets),
            rest: Number(exForm.rest)
        };

        if (editingId) {
            await updateDoc(doc(db, 'exercises', editingId), payload);
            toast.success("Exercício atualizado!", { id: loadingToast });
        } else {
            await addDoc(collection(db, 'exercises'), payload);
            toast.success("Exercício criado!", { id: loadingToast });
        }
        
        resetExerciseForm();
        fetchData();
    } catch (error) {
        console.error(error);
        toast.error("Erro ao salvar.", { id: loadingToast });
    }
  };

  const handleEditExercise = (ex) => {
      setEditingId(ex.firestoreId);
      setExForm({
          name: ex.name || '',
          muscleGroup: ex.muscleGroup || '',
          machineImage: ex.machineImage || '',
          videoUrl: ex.videoUrl || '',
          sets: ex.sets || 3,
          reps: ex.reps || '12',
          rest: ex.rest || 60,
          execution: ex.execution || ''
      });
  };

  const handleDeleteExercise = async (id) => {
    if (!(await confirm({ title: "Apagar exercício", message: "Apagar exercício?", confirmLabel: "Apagar", danger: true }))) return;
    try {
        await deleteDoc(doc(db, 'exercises', id));
        toast.success("Exercício removido!");
        fetchData();
    } catch (error) {
        console.error(error);
        toast.error("Erro ao deletar.");
    }
  };

  const resetExerciseForm = () => {
      setEditingId(null);
      setExForm(initialExForm);
  };

  // --- LÓGICA DE TREINOS ---
  const handleSaveTraining = async (e) => {
    e.preventDefault();
    if (selectedExercises.length === 0) return toast.error("Selecione exercícios!");
    
    const loadingToast = toast.loading("Salvando...");
    try {
        const payload = {
            ...trainingForm,
            exercises: selectedExercises,
            updatedAt: new Date().toISOString()
        };

        if (editingId) {
            await updateDoc(doc(db, 'trainings', editingId), payload);
            toast.success("Treino atualizado!", { id: loadingToast });
        } else {
            payload.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'trainings'), payload);
            toast.success("Treino criado!", { id: loadingToast });
        }
        
        resetTrainingForm();
        fetchData();
    } catch (error) {
        console.error(error);
        toast.error("Erro ao salvar.", { id: loadingToast });
    }
  };

  const handleEditTraining = (tr) => {
      setEditingId(tr.firestoreId);
      setTrainingForm({
          name: tr.name || '',
          description: tr.description || '',
          difficulty: tr.difficulty || 'Iniciante'
      });
      setSelectedExercises(tr.exercises || []);
  };

  const handleDeleteTraining = async (id) => {
      if (!(await confirm({ title: "Apagar treino", message: "Apagar treino?", confirmLabel: "Apagar", danger: true }))) return;
      try {
          await deleteDoc(doc(db, 'trainings', id));
          toast.success("Treino removido!");
          fetchData();
      } catch (error) {
          console.error(error);
          toast.error("Erro ao deletar.");
      }
  };

  const resetTrainingForm = () => {
      setEditingId(null);
      setTrainingForm(initialTrainingForm);
      setSelectedExercises([]);
  };

  const toggleExerciseSelection = (id) => {
      if (selectedExercises.includes(id)) {
          setSelectedExercises(prev => prev.filter(x => x !== id));
      } else {
          setSelectedExercises(prev => [...prev, id]);
      }
  };

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/home" />;

  const importLabel = activeTab === 'exercises' ? 'Importar JSON de exercícios' : 'Importar JSON de treinos';
  const term = search.trim().toLowerCase();
  const filteredExercises = exercises.filter((ex) => !term || `${ex.name} ${ex.muscleGroup}`.toLowerCase().includes(term));
  const filteredTrainings = trainings.filter((tr) => !term || String(tr.name).toLowerCase().includes(term));
  const exerciseOptions = exercises.filter((ex) => !pickerTerm || String(ex.name).toLowerCase().includes(pickerTerm.toLowerCase()));

  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-6xl space-y-5">
        <PageHeader
          eyebrow="Administração"
          title="Conteúdo do app"
          subtitle="Gerencie exercícios e fichas globais."
          actions={(
            <label className={`${btnGhost} cursor-pointer focus-within:ring-2 focus-within:ring-brand/50`}>
              <FileJson className="h-4 w-4" aria-hidden="true" /> {importLabel}
              <input type="file" accept=".json" onChange={handleImportJson} className="sr-only" />
            </label>
          )}
        />

        <Tabs
          tabs={[{ id: 'exercises', label: `Exercícios (${exercises.length})` }, { id: 'trainings', label: `Fichas (${trainings.length})` }]}
          value={activeTab}
          onChange={(id) => { setActiveTab(id); setSearch(''); resetExerciseForm(); resetTrainingForm(); }}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input type="search" aria-label="Buscar" placeholder={activeTab === 'exercises' ? 'Buscar exercício ou grupo' : 'Buscar ficha'} value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} pl-11`} />
        </div>

        {loading ? (
          <PageSkeleton cards={2} />
        ) : activeTab === 'exercises' ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <section id="admin-form" className="surface h-fit p-5 lg:sticky lg:top-24">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white">
                  {editingId ? <Edit3 className="h-5 w-5 text-orange-500" /> : <PlusCircle className="h-5 w-5 text-emerald-500" />}
                  {editingId ? 'Editar exercício' : 'Novo exercício'}
                </h2>
                {editingId && <button type="button" onClick={resetExerciseForm} className="min-h-[44px] px-2 text-xs font-bold text-rose-500">Cancelar</button>}
              </div>
              <form onSubmit={handleSaveExercise} className="space-y-4">
                <div>
                  <label htmlFor="ap-name" className={labelCls}>Nome</label>
                  <input id="ap-name" required value={exForm.name} onChange={(e) => setExForm({ ...exForm, name: e.target.value })} className={inputCls} placeholder="Ex: Supino reto" />
                </div>
                <div>
                  <label htmlFor="ap-group" className={labelCls}>Grupo muscular</label>
                  <select id="ap-group" required value={exForm.muscleGroup} onChange={(e) => setExForm({ ...exForm, muscleGroup: e.target.value })} className={`${inputCls} cursor-pointer`}>
                    <option value="">Selecione...</option>
                    {MUSCLE_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label htmlFor="ap-sets" className={labelCls}>Séries</label><input id="ap-sets" type="number" inputMode="numeric" value={exForm.sets} onChange={(e) => setExForm({ ...exForm, sets: e.target.value })} className={inputCls} /></div>
                  <div><label htmlFor="ap-reps" className={labelCls}>Reps</label><input id="ap-reps" value={exForm.reps} onChange={(e) => setExForm({ ...exForm, reps: e.target.value })} className={inputCls} /></div>
                  <div><label htmlFor="ap-rest" className={labelCls}>Desc. (s)</label><input id="ap-rest" type="number" inputMode="numeric" value={exForm.rest} onChange={(e) => setExForm({ ...exForm, rest: e.target.value })} className={inputCls} /></div>
                </div>
                <div>
                  <label htmlFor="ap-img" className={labelCls}>Link do GIF/imagem</label>
                  <input id="ap-img" type="url" inputMode="url" value={exForm.machineImage} onChange={(e) => setExForm({ ...exForm, machineImage: e.target.value })} className={inputCls} placeholder="https://..." />
                </div>
                <div>
                  <label htmlFor="ap-video" className={labelCls}>Link do vídeo (opcional)</label>
                  <input id="ap-video" type="url" inputMode="url" value={exForm.videoUrl} onChange={(e) => setExForm({ ...exForm, videoUrl: e.target.value })} className={inputCls} placeholder="https://..." />
                </div>
                <div>
                  <label htmlFor="ap-exec" className={labelCls}>Execução</label>
                  <textarea id="ap-exec" rows={3} value={exForm.execution} onChange={(e) => setExForm({ ...exForm, execution: e.target.value })} className={`${inputCls} resize-none py-3`} placeholder="Descreva como fazer..." />
                </div>
                <button type="submit" className={`${btnPrimary} w-full min-h-[52px]`}>
                  {editingId ? <CheckCircle className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />} {editingId ? 'Salvar alterações' : 'Cadastrar exercício'}
                </button>
              </form>
            </section>

            <section className="space-y-3 lg:col-span-2" aria-label="Banco de exercícios">
              {filteredExercises.length === 0 ? (
                <div className="surface"><EmptyState icon={Dumbbell} title="Nenhum exercício encontrado." /></div>
              ) : filteredExercises.map((ex, i) => (
                <article key={ex.firestoreId} className={`surface animate-fade-up flex items-center gap-3 p-3 transition ${editingId === ex.firestoreId ? 'border-orange-400 ring-2 ring-orange-400/30' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
                    {ex.machineImage ? <img src={ex.machineImage} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Dumbbell className="h-6 w-6 text-gray-400" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-gray-900 dark:text-white">{ex.name}</h3>
                    <p className="text-xs uppercase text-gray-500">{ex.muscleGroup} · {ex.sets}x{ex.reps}</p>
                  </div>
                  <button type="button" aria-label={`Editar ${ex.name}`} onClick={() => { handleEditExercise(ex); document.getElementById('admin-form')?.scrollIntoView({ behavior: 'smooth' }); }} className={iconBtn}><Edit3 className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Apagar ${ex.name}`} onClick={() => handleDeleteExercise(ex.firestoreId)} className={`${iconBtn} !text-rose-500`}><Trash2 className="h-4 w-4" /></button>
                </article>
              ))}
            </section>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <section id="admin-form" className="surface h-fit p-5 lg:sticky lg:top-24">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white">
                  {editingId ? <Edit3 className="h-5 w-5 text-orange-500" /> : <Sparkles className="h-5 w-5 text-brand" />}
                  {editingId ? 'Editar ficha' : 'Nova ficha'}
                </h2>
                {editingId && <button type="button" onClick={resetTrainingForm} className="min-h-[44px] px-2 text-xs font-bold text-rose-500">Cancelar</button>}
              </div>
              <form onSubmit={handleSaveTraining} className="space-y-4">
                <div>
                  <label htmlFor="ap-tname" className={labelCls}>Nome</label>
                  <input id="ap-tname" required value={trainingForm.name} onChange={(e) => setTrainingForm({ ...trainingForm, name: e.target.value })} className={inputCls} placeholder="Ex: Treino A" />
                </div>
                <div>
                  <label htmlFor="ap-tdesc" className={labelCls}>Descrição</label>
                  <textarea id="ap-tdesc" rows={2} value={trainingForm.description} onChange={(e) => setTrainingForm({ ...trainingForm, description: e.target.value })} className={`${inputCls} resize-none py-3`} />
                </div>
                <div>
                  <label htmlFor="ap-tlevel" className={labelCls}>Dificuldade</label>
                  <select id="ap-tlevel" value={trainingForm.difficulty} onChange={(e) => setTrainingForm({ ...trainingForm, difficulty: e.target.value })} className={`${inputCls} cursor-pointer`}>
                    <option>Iniciante</option><option>Intermediário</option><option>Avançado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ap-pick" className={labelCls}>Exercícios ({selectedExercises.length})</label>
                  <input id="ap-pick" type="search" value={pickerTerm} onChange={(e) => setPickerTerm(e.target.value)} placeholder="Filtrar exercícios" className={`${inputCls} mb-2`} />
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl bg-gray-100 p-2 dark:bg-white/5" role="group" aria-label="Selecionar exercícios">
                    {exerciseOptions.map((ex) => {
                      const on = selectedExercises.includes(ex.firestoreId);
                      return (
                        <button key={ex.firestoreId} type="button" aria-pressed={on} onClick={() => toggleExerciseSelection(ex.firestoreId)}
                          className={`flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-left text-sm transition ${on ? 'bg-brand font-bold text-black' : 'text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-white/10'}`}>
                          <span className="truncate">{ex.name}</span>{on && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="submit" className={`${btnPrimary} w-full min-h-[52px]`}><Save className="h-5 w-5" /> {editingId ? 'Salvar ficha' : 'Criar ficha'}</button>
              </form>
            </section>

            <section className="space-y-3" aria-label="Fichas">
              {filteredTrainings.length === 0 ? (
                <div className="surface"><EmptyState icon={Dumbbell} title="Nenhuma ficha encontrada." /></div>
              ) : filteredTrainings.map((tr, i) => (
                <article key={tr.firestoreId} className={`surface animate-fade-up p-4 transition ${editingId === tr.firestoreId ? 'border-orange-400 ring-2 ring-orange-400/30' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-black text-gray-900 dark:text-white">{tr.name}</h3>
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-brand">{tr.difficulty || 'Ficha'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" aria-label={`Editar ${tr.name}`} onClick={() => { handleEditTraining(tr); document.getElementById('admin-form')?.scrollIntoView({ behavior: 'smooth' }); }} className={iconBtn}><Edit3 className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Apagar ${tr.name}`} onClick={() => handleDeleteTraining(tr.firestoreId)} className={`${iconBtn} !text-rose-500`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tr.exercises?.map((item, idx) => {
                      const id = typeof item === 'string' ? item : (item?.firestoreId || item?.id);
                      const name = typeof item === 'object' && item?.name ? item.name : exercises.find((e) => e.firestoreId === id)?.name;
                      return name ? <span key={`${id}-${idx}`} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">{name}</span> : null;
                    })}
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
