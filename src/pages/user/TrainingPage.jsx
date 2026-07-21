import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import toast from 'react-hot-toast';
import { Dumbbell, Flame, Scale, ClipboardList } from 'lucide-react';

export default function TrainingPage() {
  const { trainingId } = useParams();
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorDebug, setErrorDebug] = useState(null);
  const [lastWorkoutDate, setLastWorkoutDate] = useState(null);

  // Estados de Personalização
  const [exerciseList, setExerciseList] = useState([]);
  const [selectedExercises, setSelectedExercises] = useState({});
  const [historyMap, setHistoryMap] = useState({}); // { "Supino": 30 } (Última carga)
  
  // Drag & Drop Refs
  const dragItem = useRef();
  const dragOverItem = useRef();

  // 1. CARREGAMENTO DE DADOS
  useEffect(() => {
    let isMounted = true;

    const fetchTrainingData = async () => {
      try {
        if (!trainingId) throw new Error("ID do treino indefinido.");

        // A. Busca Treino (Robustez: Tenta ID do Doc e depois firestoreId)
        let docSnap = await getDoc(doc(db, 'trainings', trainingId));
        let finalData = null;
        let finalId = null;

        if (docSnap.exists()) {
            finalData = docSnap.data();
            finalId = docSnap.id;
        } else {
             // Fallback para IDs antigos salvos manualmente
             const q = query(collection(db, 'trainings'), where('firestoreId', '==', trainingId));
             const qSnap = await getDocs(q);
             if (!qSnap.empty) {
                 finalData = qSnap.docs[0].data();
                 finalId = qSnap.docs[0].id;
             } else {
                 throw new Error("Treino não encontrado.");
             }
        }

        // B. Busca Biblioteca para Hidratação (Corrige o problema de String vs Objeto)
        const exercisesSnap = await getDocs(collection(db, 'exercises'));
        const allExercises = exercisesSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));

        const hydratedExercises = (finalData.exercises || []).map((ex, index) => {
             // Lógica para encontrar o exercício na biblioteca global
             let idToFind = null;
             let nameToFind = null;

             if (typeof ex === 'string') {
                 idToFind = ex; // Formato antigo: array de IDs
             } else {
                 idToFind = ex.firestoreId || ex.id; // Formato novo: objeto
                 nameToFind = ex.name;
             }
             
             // Busca na biblioteca
             const libEx = allExercises.find(e => 
                (idToFind && (String(e.firestoreId) === String(idToFind) || String(e.id) === String(idToFind))) || 
                (nameToFind && e.name === nameToFind)
             );

             return {
                 // Prioridades: Dados do Treino > Dados da Biblioteca > Defaults
                 firestoreId: idToFind || `temp-${index}`,
                 name: (typeof ex === 'object' && ex.name) ? ex.name : (libEx?.name || 'Exercício'),
                 // Imagem: Prioriza biblioteca para estar sempre atualizada
                 machineImage: libEx?.machineImage || libEx?.demoUrl || (typeof ex === 'object' ? ex.machineImage : null) || null,
                 muscleGroup: (typeof ex === 'object' && ex.muscleGroup) ? ex.muscleGroup : (libEx?.muscleGroup || ''),
                 sets: (typeof ex === 'object' && ex.sets) ? ex.sets : '3',
                 reps: (typeof ex === 'object' && ex.reps) ? ex.reps : '10',
             };
        });

        if (isMounted) {
            setTraining({ ...finalData, firestoreId: finalId });
            setExerciseList(hydratedExercises);
            
            // Seleciona todos por padrão
            const initialSelection = {};
            hydratedExercises.forEach((_, i) => initialSelection[i] = true);
            setSelectedExercises(initialSelection);
        }

        // C. Busca Histórico (Opcional - Última Carga)
        try {
            const qHistory = query(
                collection(db, 'checkIns'), 
                where('userId', '==', user.uid),
                orderBy('date', 'desc'),
                limit(10)
            );
            const historySnap = await getDocs(qHistory);
            const loadMap = {};
            let foundDate = false;

            historySnap.docs.forEach(doc => {
                const hData = doc.data();
                // Data do último treino igual a este
                if (!foundDate && (hData.trainingId === finalId || hData.trainingName === finalData.name)) {
                    if (isMounted) {
                        setLastWorkoutDate(new Date(hData.date));
                        foundDate = true;
                    }
                }
                // Cargas
                if (hData.exercises) {
                    hData.exercises.forEach(hEx => {
                        if (!loadMap[hEx.name]) {
                            const maxW = Math.max(...(hEx.sets?.map(s => Number(s.weight) || 0) || [0]));
                            if (maxW > 0) loadMap[hEx.name] = maxW;
                        }
                    });
                }
            });
            if (isMounted) setHistoryMap(loadMap);
        } catch (e) { console.warn("Histórico ignorado", e); }

        if (isMounted) setLoading(false);

      } catch (error) {
        console.error("Erro Fetch Training:", error);
        if (isMounted) {
            setErrorDebug(error.message);
            setLoading(false);
        }
      }
    };

    fetchTrainingData();
    return () => { isMounted = false; };
  }, [trainingId, user]);

  // 2. LÓGICA DE DRAG & DROP
  const dragStart = (e, position) => {
    dragItem.current = position;
  };
  const dragEnter = (e, position) => {
    dragOverItem.current = position;
  };
  const drop = () => {
    const copyListItems = [...exerciseList];
    const dragItemContent = copyListItems[dragItem.current];
    copyListItems.splice(dragItem.current, 1);
    copyListItems.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setExerciseList(copyListItems);
    const newSelection = {};
    copyListItems.forEach((_, i) => newSelection[i] = true);
    setSelectedExercises(newSelection);
  };
  const toggleSelection = (index) => {
      setSelectedExercises(prev => ({...prev, [index]: !prev[index]}));
  };

  // 3. INICIAR TREINO (Ação Principal)
  const handleStartTraining = () => {
    if (training) {
      const activeExercises = exerciseList.filter((_, i) => selectedExercises[i]);
      
      if (activeExercises.length === 0) {
          toast.error("Selecione pelo menos um exercício!");
          return;
      }

      // ✅ ROTA CORRETA: Envia para /execution/ (TrainingExecutionPage)
      // Envia a lista customizada (caso o usuário tenha reordenado ou desmarcado algo)
      navigate(`/execution/${training.firestoreId}`, { 
          state: { 
              customExerciseList: activeExercises,
              originalTraining: training 
          } 
      });
    }
  };

  const calculateEstimatedVolume = () => {
      let total = 0;
      exerciseList.forEach((ex, i) => {
          if (selectedExercises[i]) {
              const weight = historyMap[ex.name] || 0;
              const sets = Number(ex.sets) || 3;
              const reps = Number(String(ex.reps).split('-')[0]) || 10;
              total += weight * sets * reps;
          }
      });
      return total;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div></div>;

  if (errorDebug) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-6 text-center text-white">
        <div className="text-4xl mb-4">🚧</div>
        <p className="mb-4 text-red-300">{errorDebug}</p>
        <button onClick={() => navigate('/trainings')} className="bg-blue-600 px-6 py-3 rounded-xl font-bold">Voltar</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-40"> 
        {/* HEADER */}
        <div className="bg-white dark:bg-gray-800 p-6 pt-8 pb-6 shadow-sm border-b border-gray-100 dark:border-gray-700">
            <button onClick={() => navigate('/trainings')} className="mb-4 text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white flex items-center gap-1 transition-colors">
                ← Voltar
            </button>
            
            <div className="flex justify-between items-start gap-4 mb-2">
                <h1 className="text-3xl font-black text-gray-800 dark:text-white leading-tight">{training.name}</h1>
                {lastWorkoutDate && (
                    <div className="text-right shrink-0 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg border border-green-100 dark:border-green-800/30">
                        <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">Último</p>
                        <p className="text-xs font-bold text-gray-700 dark:text-white">{lastWorkoutDate.toLocaleDateString('pt-BR')}</p>
                    </div>
                )}
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
                {training.description || "Prepare-se para superar seus limites."}
            </p>

            <div className="flex gap-3">
                <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300">
                    <ClipboardList className="w-3.5 h-3.5 text-gray-500" /> {exerciseList.filter((_,i) => selectedExercises[i]).length} Exercícios
                </span>
                <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full text-xs font-bold text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800/30">
                    <Scale className="w-3.5 h-3.5 text-blue-500" /> Vol. Est: {calculateEstimatedVolume() > 0 ? `${(calculateEstimatedVolume() / 1000).toFixed(1)}t` : '--'}
                </span>
            </div>
        </div>

        {/* LISTA DE EXERCÍCIOS */}
        <div className="p-4 max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Roteiro</h2>
                <span className="text-[10px] text-gray-400">Arraste para ordenar</span>
            </div>

            {exerciseList.map((exercise, index) => {
                const isSelected = selectedExercises[index];
                const lastLoad = historyMap[exercise.name];

                return (
                    <div 
                        key={index}
                        draggable
                        onDragStart={(e) => dragStart(e, index)}
                        onDragEnter={(e) => dragEnter(e, index)}
                        onDragEnd={drop}
                        className={`flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border transition-all duration-200 ${
                            !isSelected 
                            ? 'opacity-60 border-transparent bg-gray-50 dark:bg-gray-800/50' 
                            : 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800'
                        }`}
                    >
                        {/* Checkbox */}
                        <div 
                            onClick={(e) => { e.stopPropagation(); toggleSelection(index); }}
                            className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
                                isSelected 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30' 
                                : 'border-gray-300 dark:border-gray-600 bg-transparent'
                            }`}
                        >
                            {isSelected && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                        </div>

                        {/* Imagem */}
                        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-gray-600 relative">
                            {exercise.machineImage ? (
                                <img src={exercise.machineImage} alt={exercise.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                </div>
                            )}
                            <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-tl-md backdrop-blur-sm">
                                #{index + 1}
                            </div>
                        </div>

                        {/* Infos */}
                        <div className="flex-1 min-w-0 select-none">
                            <h3 className={`font-bold text-sm truncate ${isSelected ? 'text-gray-800 dark:text-white' : 'text-gray-500'}`}>
                                {exercise.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                                    {exercise.sets} x {exercise.reps}
                                </span>
                                {lastLoad && (
                                    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-800/30">
                                        ↺ {lastLoad}kg
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Handle */}
                        <div className="text-gray-300 dark:text-gray-600 px-2 cursor-grab active:cursor-grabbing hover:text-gray-500 drag-handle">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* FOOTER FIXO */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 z-[60] pb-8 md:pb-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <button 
                onClick={handleStartTraining}
                className="w-full bg-gradient-to-r from-[#FFC107] to-[#FF9800] hover:from-[#FFC107] hover:to-[#FFB300] text-black font-black text-lg py-4 rounded-2xl shadow-xl shadow-[#FFC107]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group hover-glow-brand"
            >
                <Flame className="w-5 h-5 text-black fill-current group-hover:scale-110 transition-transform" /> 
                INICIAR TREINO 
            </button>
        </div>
    </div>
  );
}