import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';

export default function WorkoutEditor() {
  const { trainingId } = useParams();
  const navigate = useNavigate();
  
  const [training, setTraining] = useState(null);
  const [library, setLibrary] = useState([]); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carregar Treino e Biblioteca
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Treino
        const docRef = doc(db, 'trainings', trainingId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            setTraining({ id: docSnap.id, ...docSnap.data() });
        } else {
            toast.error("Treino não encontrado");
            navigate('/admin/trainings');
        }

        // 2. Biblioteca
        const qLib = query(collection(db, 'exercises'), orderBy('name'));
        const libSnap = await getDocs(qLib);
        setLibrary(libSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [trainingId, navigate]);

  // Atualizar cabeçalho (Nome, Descrição)
  const handleUpdateHeader = (field, value) => {
      setTraining(prev => ({ ...prev, [field]: value }));
  };

  // Adicionar exercício da biblioteca
  const addExerciseToWorkout = (exercise) => {
      const newExercise = {
          ...exercise,
          exerciseId: exercise.id, 
          // Config padrão de sets
          sets: [{ weight: '', reps: '12' }, { weight: '', reps: '10' }, { weight: '', reps: '8' }] 
      };
      
      setTraining(prev => ({
          ...prev,
          exercises: [...(prev.exercises || []), newExercise]
      }));
      setShowAddModal(false);
      toast.success("Adicionado!");
  };

  const removeExercise = (index) => {
      const newExercises = [...training.exercises];
      newExercises.splice(index, 1);
      setTraining(prev => ({ ...prev, exercises: newExercises }));
  };

  const saveAll = async () => {
      const loadingToast = toast.loading("Salvando ficha...");
      try {
          await updateDoc(doc(db, 'trainings', trainingId), {
              ...training,
              updatedAt: serverTimestamp()
          });
          toast.success("Salvo com sucesso!", { id: loadingToast });
      } catch (error) {
          toast.error("Erro ao salvar.", { id: loadingToast });
      }
  };

  if (loading || !training) return <div className="h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 pb-32">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header de Edição */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start mb-4">
                <button onClick={() => navigate('/admin/trainings')} className="text-gray-400 hover:text-gray-600 text-sm">← Voltar</button>
                <button onClick={saveAll} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-transform active:scale-95">
                    Salvar Ficha 💾
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Nome da Ficha</label>
                    <input 
                        value={training.name}
                        onChange={(e) => handleUpdateHeader('name', e.target.value)}
                        className="w-full text-2xl font-black text-gray-800 dark:text-white bg-transparent outline-none placeholder-gray-300 border-b border-transparent focus:border-blue-500 transition-colors"
                        placeholder="Nome do Treino..."
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Nível</label>
                    <select 
                        value={training.difficulty}
                        onChange={(e) => handleUpdateHeader('difficulty', e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-sm font-bold dark:text-white outline-none cursor-pointer"
                    >
                        <option>Iniciante</option>
                        <option>Intermediário</option>
                        <option>Avançado</option>
                        <option>Elite</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Instruções</label>
                    <textarea 
                        value={training.description}
                        onChange={(e) => handleUpdateHeader('description', e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl text-sm dark:text-gray-300 outline-none resize-none h-20 focus:ring-2 focus:ring-blue-500/50 transition-all"
                        placeholder="Ex: Descanso de 60s entre séries..."
                    />
                </div>
            </div>
        </div>

        {/* Lista de Exercícios */}
        <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Rotina ({training.exercises?.length || 0})</h2>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="text-blue-600 font-bold text-sm bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                >
                    + Adicionar Exercício
                </button>
            </div>

            {(training.exercises || []).map((ex, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative group animate-fade-in-up">
                    <button 
                        onClick={() => removeExercise(index)}
                        className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                        title="Remover exercício"
                    >
                        ✕
                    </button>
                    
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0">
                            {ex.demoUrl ? <img src={ex.demoUrl} className="w-full h-full object-cover" alt=""/> : <div className="flex items-center justify-center h-full text-xl">🏋️</div>}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white">{ex.name}</h3>
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500">{ex.muscleGroup}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg">
                        <span>Configuração:</span>
                        <span className="font-bold text-gray-600 dark:text-gray-300">3 Séries (12-10-8 Reps)</span>
                    </div>
                </div>
            ))}

            {(!training.exercises || training.exercises.length === 0) && (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-400">
                    <p className="mb-2">A ficha está vazia.</p>
                    <button onClick={() => setShowAddModal(true)} className="text-blue-600 font-bold hover:underline">Adicionar da Biblioteca</button>
                </div>
            )}
        </div>

        {/* MODAL DE SELEÇÃO */}
        {showAddModal && (
            <Modal onClose={() => setShowAddModal(false)} label="Biblioteca de exercícios" className="w-full max-w-2xl">
                <div className="bg-white dark:bg-gray-800 w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="font-bold text-lg dark:text-white">Biblioteca de Exercícios</h3>
                        <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {library.length === 0 ? (
                            <div className="col-span-full text-center text-gray-400 py-10">
                                <p>Biblioteca vazia.</p>
                                <button onClick={() => navigate('/admin/exercises')} className="text-blue-500 underline text-sm">Cadastrar exercícios</button>
                            </div>
                        ) : (
                            library.map(libEx => (
                                <div 
                                    key={libEx.id}
                                    onClick={() => addExerciseToWorkout(libEx)}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-blue-200"
                                >
                                    <div className="w-10 h-10 bg-white dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                                        {libEx.demoUrl ? <img src={libEx.demoUrl} className="w-full h-full object-cover" alt=""/> : null}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800 dark:text-white truncate">{libEx.name}</p>
                                        <p className="text-xs text-gray-500">{libEx.muscleGroup}</p>
                                    </div>
                                    <span className="text-blue-500 font-bold text-xl">+</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>
        )}

      </div>
    </div>
  );
}