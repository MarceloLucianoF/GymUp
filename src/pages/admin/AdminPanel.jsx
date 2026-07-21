import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { useAdmin } from '../../hooks/useAdmin';
import { Navigate } from 'react-router-dom';
import { Wrench, FileJson, Edit3, Trash2, Check, Save, PlusCircle, CheckCircle, Sparkles } from 'lucide-react';

export default function AdminPanel() {
  const { isAdmin, loading: authLoading } = useAdmin();
  const [activeTab, setActiveTab] = useState('exercises');
  
  const [exercises, setExercises] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if(!window.confirm("Apagar exercício?")) return;
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
      if(!window.confirm("Apagar treino?")) return;
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

  const importLabel = activeTab === 'exercises' ? 'Importar JSON de Exercícios' : 'Importar JSON de Treinos';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 transition-colors">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">Painel do Treinador <Wrench className="w-7 h-7 text-blue-600 dark:text-blue-400" /></h1>
                <p className="text-gray-500">Gerencie o conteúdo do aplicativo.</p>
            </div>

            <div className="relative overflow-hidden group">
                <button className="bg-gray-800 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors shadow-lg">
                    <FileJson className="w-4 h-4" /> {importLabel}
                </button>
                <input 
                    type="file" 
                    accept=".json"
                    onChange={handleImportJson}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    title={importLabel}
                />
            </div>
        </div>

        {/* Abas */}
        <div className="flex gap-4 mb-8 border-b border-gray-200 dark:border-gray-700">
            <button 
                onClick={() => { setActiveTab('exercises'); resetTrainingForm(); }}
                className={`pb-4 px-4 font-bold transition-colors ${activeTab === 'exercises' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
                1. Gerenciar Exercícios
            </button>
            <button 
                onClick={() => { setActiveTab('trainings'); resetExerciseForm(); }}
                className={`pb-4 px-4 font-bold transition-colors ${activeTab === 'trainings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
                2. Montar Treinos
            </button>
        </div>

        {/* --- ABA EXERCÍCIOS --- */}
        {activeTab === 'exercises' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                {/* Formuário */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-fit sticky top-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-xl text-gray-800 dark:text-white flex items-center gap-1.5">
                            {editingId ? <Edit3 className="w-5 h-5 text-orange-500" /> : <PlusCircle className="w-5 h-5 text-green-500" />}
                            {editingId ? 'Editar Exercício' : 'Novo Exercício'}
                        </h3>
                        {editingId && (
                            <button onClick={resetExerciseForm} className="text-xs text-red-500 hover:underline">Cancelar</button>
                        )}
                    </div>
                    
                    <form onSubmit={handleSaveExercise} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Nome</label>
                            <input required type="text" value={exForm.name} onChange={e => setExForm({...exForm, name: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ex: Supino Reto" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Grupo Muscular</label>
                            <select required value={exForm.muscleGroup} onChange={e => setExForm({...exForm, muscleGroup: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="">Selecione...</option>
                                <option value="peito">Peito</option>
                                <option value="costas">Costas</option>
                                <option value="pernas">Pernas</option>
                                <option value="ombros">Ombros</option>
                                <option value="braços">Braços</option>
                                <option value="core">Core</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                             <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Séries</label>
                                <input type="number" value={exForm.sets} onChange={e => setExForm({...exForm, sets: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                             </div>
                             <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Reps</label>
                                <input type="text" value={exForm.reps} onChange={e => setExForm({...exForm, reps: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                             </div>
                             <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Rest(s)</label>
                                <input type="number" value={exForm.rest} onChange={e => setExForm({...exForm, rest: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                             </div>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Link do GIF</label>
                            <input type="text" value={exForm.machineImage} onChange={e => setExForm({...exForm, machineImage: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Cole o link aqui..." />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Execução</label>
                            <textarea rows="3" value={exForm.execution} onChange={e => setExForm({...exForm, execution: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Descreva como fazer..." />
                        </div>
                        
                        <button type="submit" className={`w-full text-white font-bold py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-1.5 ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}>
                            {editingId ? <CheckCircle className="w-5 h-5 text-white" /> : <PlusCircle className="w-5 h-5 text-white" />}
                            {editingId ? 'Salvar Alterações' : 'Cadastrar Exercício'}
                        </button>
                    </form>
                </div>

                {/* Lista */}
                <div className="lg:col-span-2 space-y-3">
                    <h3 className="font-bold text-gray-800 dark:text-white">Banco de Exercícios ({exercises.length})</h3>
                    {exercises.map(ex => (
                        <div key={ex.firestoreId} className={`bg-white dark:bg-gray-800 p-4 rounded-xl border flex justify-between items-center group transition-all ${editingId === ex.firestoreId ? 'border-orange-400 ring-2 ring-orange-400/20' : 'border-gray-100 dark:border-gray-700'}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shrink-0">
                                    {ex.machineImage ? <img src={ex.machineImage} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full text-xs">IMG</span>}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white line-clamp-1">{ex.name}</h4>
                                    <p className="text-xs text-gray-500 uppercase">{ex.muscleGroup} • {ex.sets}x{ex.reps}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEditExercise(ex)} className="text-gray-400 hover:text-blue-500 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors flex items-center justify-center">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteExercise(ex.firestoreId)} className="text-gray-400 hover:text-red-500 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors flex items-center justify-center">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- ABA TREINOS --- */}
        {activeTab === 'trainings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                
                {/* Construtor */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-fit sticky top-6">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-xl text-gray-800 dark:text-white flex items-center gap-1.5">
                            {editingId ? <Edit3 className="w-5 h-5 text-orange-500" /> : <Sparkles className="w-5 h-5 text-blue-500" />}
                            {editingId ? 'Editar Ficha' : 'Nova Ficha'}
                        </h3>
                        {editingId && (
                            <button onClick={resetTrainingForm} className="text-xs text-red-500 hover:underline">Cancelar</button>
                        )}
                    </div>
                     
                     <form onSubmit={handleSaveTraining} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Nome do Treino</label>
                            <input required type="text" value={trainingForm.name} onChange={e => setTrainingForm({...trainingForm, name: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ex: Treino A" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
                            <textarea value={trainingForm.description} onChange={e => setTrainingForm({...trainingForm, description: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Dificuldade</label>
                            <select value={trainingForm.difficulty} onChange={e => setTrainingForm({...trainingForm, difficulty: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="Iniciante">Iniciante</option>
                                <option value="Intermediário">Intermediário</option>
                                <option value="Avançado">Avançado</option>
                            </select>
                        </div>

                        {/* Seleção */}
                        <div className="mt-4">
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Exercícios ({selectedExercises.length})</label>
                            <div className="h-60 overflow-y-auto border dark:border-gray-700 rounded-xl p-2 space-y-1 bg-gray-50 dark:bg-gray-900">
                                {exercises.map(ex => (
                                    <div 
                                        key={ex.firestoreId} 
                                        onClick={() => toggleExerciseSelection(ex.firestoreId)}
                                        className={`p-3 rounded-lg cursor-pointer text-sm flex justify-between items-center transition-colors ${
                                            selectedExercises.includes(ex.firestoreId) 
                                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold' 
                                            : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <span>{ex.name}</span>
                                        {selectedExercises.includes(ex.firestoreId) && <Check className="w-4 h-4 text-green-600 dark:text-green-400" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button type="submit" className={`w-full text-white font-bold py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-1.5 ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            <Save className="w-5 h-5 text-white" />
                            {editingId ? 'Salvar Ficha' : 'Criar Ficha'}
                        </button>
                     </form>
                </div>

                {/* Lista */}
                <div className="space-y-4">
                    <h3 className="font-bold text-gray-800 dark:text-white">Fichas Ativas ({trainings.length})</h3>
                    {trainings.map(tr => (
                        <div key={tr.firestoreId} className={`bg-white dark:bg-gray-800 p-5 rounded-xl border shadow-sm transition-all ${editingId === tr.firestoreId ? 'border-orange-400 ring-2 ring-orange-400/20' : 'border-gray-100 dark:border-gray-700'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">{tr.name}</h4>
                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-bold text-gray-600 dark:text-gray-300">{tr.difficulty}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditTraining(tr)} className="text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg transition-colors flex items-center justify-center">
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteTraining(tr.firestoreId)} className="text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg transition-colors flex items-center justify-center">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Exercícios:</p>
                                <div className="flex flex-wrap gap-2">
                                    {tr.exercises?.map(exId => {
                                        const ex = exercises.find(e => e.firestoreId === exId);
                                        return ex ? (
                                            <span key={exId} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-2 py-1 rounded border border-blue-100 dark:border-blue-900">
                                                {ex.name}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        )}

      </div>
    </div>
  );
}