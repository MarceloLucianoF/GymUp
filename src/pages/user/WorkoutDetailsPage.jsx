import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Clock, Scale, CheckCircle2, Dumbbell, FileText, XCircle, ArrowLeft } from 'lucide-react';

export default function WorkoutDetailsPage() {
  const { checkInId } = useParams();
  const navigate = useNavigate();
  
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const docRef = doc(db, 'checkIns', checkInId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setWorkout(docSnap.data());
        } else {
          console.error("Treino não encontrado");
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [checkInId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>;

  if (!workout) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center text-gray-500">
        <p className="text-xl">Treino não encontrado.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-500 hover:underline">Voltar</button>
    </div>
  );

  // Formatação
  const date = new Date(workout.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const durationMinutes = Math.floor(workout.duration / 60);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 pb-32 transition-colors">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header com Botão Voltar */}
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-white transition-colors flex items-center justify-center">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-2xl font-black text-gray-800 dark:text-white leading-tight">{workout.trainingName}</h1>
                <p className="text-sm text-gray-500 capitalize">{date}</p>
            </div>
        </div>

        {/* Resumo Geral (Stats) */}
        <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center flex flex-col items-center justify-center">
                <Clock className="w-6 h-6 text-gray-400 dark:text-gray-500 mb-1" />
                <p className="text-[10px] uppercase font-bold text-gray-400">Duração</p>
                <p className="font-black text-gray-800 dark:text-white text-lg">{durationMinutes} min</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center flex flex-col items-center justify-center">
                <Scale className="w-6 h-6 text-gray-400 dark:text-gray-500 mb-1" />
                <p className="text-[10px] uppercase font-bold text-gray-400">Volume</p>
                <p className="font-black text-gray-800 dark:text-white text-lg">{(workout.totalVolume / 1000).toFixed(1)} ton</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center flex flex-col items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-gray-400 dark:text-gray-500 mb-1" />
                <p className="text-[10px] uppercase font-bold text-gray-400">Exercícios</p>
                <p className="font-black text-gray-800 dark:text-white text-lg">{workout.exercises?.length || 0}</p>
            </div>
        </div>

        {/* Lista de Exercícios Detalhada */}
        <div className="space-y-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 ml-1 text-sm uppercase tracking-wider">Detalhes da Sessão</h3>
            
            {workout.exercises?.map((ex, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 mb-4 border-b border-gray-50 dark:border-gray-700/50 pb-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                             {ex.machineImage ? (
                                <img src={ex.machineImage} className="w-full h-full object-cover" alt="" />
                             ) : (
                                <Dumbbell className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                             )}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 dark:text-white text-lg">{ex.name}</h4>
                            <p className="text-xs text-gray-500">{ex.muscleGroup}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                        <span>Set</span>
                        <span>Carga (kg)</span>
                        <span>Reps</span>
                        <span>Status</span>
                    </div>

                    <div className="space-y-2">
                        {ex.sets?.map((set, j) => (
                            <div key={j} className="grid grid-cols-4 gap-2 text-center items-center py-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
                                <span className="font-mono text-gray-400 text-xs">{j + 1}</span>
                                <span className="font-black text-gray-800 dark:text-white">{set.weight || '-'}</span>
                                <span className="font-bold text-gray-600 dark:text-gray-300">{set.reps || '-'}</span>
                                <span className="flex items-center justify-center">
                                  {set.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>

        {/* Observações do Aluno */}
        {workout.notes && (
            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-5 rounded-2xl border border-yellow-200 dark:border-yellow-800/30 flex gap-3">
                <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-yellow-800 dark:text-yellow-500 mb-1 text-sm">Notas do Treino</h4>
                    <p className="text-sm text-yellow-900 dark:text-yellow-100/80 italic">"{workout.notes}"</p>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}