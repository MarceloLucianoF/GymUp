import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../../components/common/Modal';

// --- 1. MODAL DE SELEÇÃO DE EXERCÍCIOS ---
const ExerciseSelector = ({ isOpen, onClose, onSelect }) => {
    const [exercises, setExercises] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            try {
                // Busca exercícios do sistema (ou criados pelo coach)
                const q = query(collection(db, 'exercises'), orderBy('name'));
                const snap = await getDocs(q);
                
                // Normalização: Tenta 'machineImage' E 'demoUrl' (correção do bug)
                const list = snap.docs.map(d => {
                    const data = d.data();
                    return { 
                        firestoreId: d.id, 
                        ...data,
                        machineImage: data.machineImage || data.demoUrl || null // Garante imagem
                    };
                });
                setExercises(list);
            } catch (error) {
                console.error("Erro ao carregar:", error);
            }
        };
        load();
    }, [isOpen]);

    const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} label="Adicionar exercício" className="w-full max-w-lg">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white">Adicionar Exercício</h3>
                    <button aria-label="Fechar" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                
                <div className="p-4">
                    <input 
                        className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl outline-none dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Buscar (ex: Supino)..."
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-2">
                    {filtered.map(ex => (
                        <div 
                            key={ex.firestoreId}
                            onClick={() => { onSelect(ex); onClose(); }}
                            className="flex items-center gap-3 p-2 hover:bg-blue-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-200 dark:hover:border-gray-600"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0">
                                {ex.machineImage ? (
                                    <img src={ex.machineImage} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs">🏋️</div>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-sm text-gray-800 dark:text-white">{ex.name}</p>
                                <p className="text-xs text-gray-500">{ex.muscleGroup}</p>
                            </div>
                            <span className="text-blue-500 font-bold text-xl">+</span>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-center text-gray-400 text-sm py-4">Nenhum exercício encontrado.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// --- 2. EDITOR DE TREINO (FORMULÁRIO) ---
const TrainingEditor = ({ training, onSave, onCancel }) => {
    const [form, setForm] = useState({
        name: '',
        description: '',
        difficulty: 'Iniciante',
        exercises: [] 
    });
    const [showExSelector, setShowExSelector] = useState(false);

    useEffect(() => {
        if (training) {
            setForm(training);
        }
    }, [training]);

    const handleAddExercise = (ex) => {
        setForm(prev => ({
            ...prev,
            exercises: [...(prev.exercises || []), {
                firestoreId: ex.firestoreId,
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                machineImage: ex.machineImage, // Já normalizado no seletor
                sets: '3', 
                reps: '10', 
                rest: '60' 
            }]
        }));
        toast.success("Adicionado!");
    };

    const updateExercise = (index, field, value) => {
        const newExs = [...form.exercises];
        newExs[index] = { ...newExs[index], [field]: value };
        setForm({ ...form, exercises: newExs });
    };

    const removeExercise = (index) => {
        setForm({ ...form, exercises: form.exercises.filter((_, i) => i !== index) });
    };

    const moveExercise = (index, direction) => {
        const newExs = [...form.exercises];
        if (direction === -1 && index > 0) {
            [newExs[index], newExs[index - 1]] = [newExs[index - 1], newExs[index]];
        } else if (direction === 1 && index < newExs.length - 1) {
            [newExs[index], newExs[index + 1]] = [newExs[index + 1], newExs[index]];
        }
        setForm({ ...form, exercises: newExs });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    {training?.firestoreId ? 'Editar Ficha' : 'Nova Ficha'}
                </h2>
                <button onClick={onCancel} className="text-sm text-gray-500 hover:text-red-500 font-bold px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
            </div>

            {/* Campos Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Nome da Ficha</label>
                    <input 
                        value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mt-1 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Hipertrofia A"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Nível</label>
                    <select 
                        value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mt-1 dark:text-white outline-none cursor-pointer"
                    >
                        <option>Iniciante</option>
                        <option>Intermediário</option>
                        <option>Avançado</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Descrição / Instruções</label>
                    <input 
                        value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mt-1 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Descanso de 60s entre séries, foco na execução..."
                    />
                </div>
            </div>

            {/* Lista de Exercícios */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200">Rotina ({form.exercises?.length || 0})</h3>
                    <button 
                        type="button"
                        onClick={() => setShowExSelector(true)}
                        className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
                    >
                        + Adicionar
                    </button>
                </div>

                <div className="space-y-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl min-h-[100px] border border-gray-100 dark:border-gray-700/50">
                    {(!form.exercises || form.exercises.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-24 text-gray-400 text-sm">
                            <span>📝</span>
                            <p>Adicione exercícios para montar a ficha.</p>
                        </div>
                    )}
                    
                    {form.exercises?.map((ex, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-3 items-center group">
                            
                            {/* Ordenação */}
                            <div className="flex flex-col gap-1">
                                <button onClick={() => moveExercise(i, -1)} disabled={i===0} className="text-gray-300 hover:text-blue-500 disabled:opacity-10 text-[10px]">▲</button>
                                <span className="text-xs font-mono font-bold text-gray-400 text-center">{i+1}</span>
                                <button onClick={() => moveExercise(i, 1)} disabled={i===form.exercises.length-1} className="text-gray-300 hover:text-blue-500 disabled:opacity-10 text-[10px]">▼</button>
                            </div>

                            {/* Info */}
                            <div className="flex items-center gap-3 flex-1 w-full">
                                <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                    {ex.machineImage ? <img src={ex.machineImage} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full flex items-center justify-center text-xs">🏋️</div>}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm truncate text-gray-800 dark:text-white">{ex.name}</p>
                                    <p className="text-[10px] text-gray-500 uppercase">{ex.muscleGroup}</p>
                                </div>
                            </div>

                            {/* Configs (Sets/Reps) */}
                            <div className="flex gap-2 w-full md:w-auto items-end">
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-gray-400 block mb-0.5">Sets</label>
                                    <input value={ex.sets} onChange={e=>updateExercise(i, 'sets', e.target.value)} className="w-12 bg-gray-100 dark:bg-gray-700 rounded p-1 text-center text-sm font-bold outline-none dark:text-white focus:ring-1 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-gray-400 block mb-0.5">Reps</label>
                                    <input value={ex.reps} onChange={e=>updateExercise(i, 'reps', e.target.value)} className="w-16 bg-gray-100 dark:bg-gray-700 rounded p-1 text-center text-sm font-bold outline-none dark:text-white focus:ring-1 focus:ring-blue-500" />
                                </div>
                                <button onClick={() => removeExercise(i)} className="text-gray-300 hover:text-red-500 p-2 transition-colors">🗑</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button onClick={() => onSave(form)} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-600/20 active:scale-95 transition-all">
                    Salvar Ficha 💾
                </button>
            </div>

            <ExerciseSelector 
                isOpen={showExSelector} 
                onClose={() => setShowExSelector(false)} 
                onSelect={handleAddExercise} 
            />
        </div>
    );
};

// --- 3. PÁGINA PRINCIPAL DO COACH ---

export default function CoachTrainingsPage() {
    const { confirm, dialog } = useConfirm();
    const { user } = useAuthContext();
    const navigate = useNavigate();

    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTraining, setEditingTraining] = useState(null); // null=lista, {}=novo, {...}=editar

    // Fetch Inicial
    const fetchTrainings = useCallback(async () => {
        try {
            // Filtra apenas treinos deste Coach
            const q = query(
                collection(db, 'trainings'), 
                where('coachId', '==', user.uid),
                orderBy('updatedAt', 'desc')
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(docSnap => ({ firestoreId: docSnap.id, ...docSnap.data() }));
            setTrainings(data);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar treinos");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if(user) fetchTrainings();
    }, [user, fetchTrainings]);

    const handleSave = async (trainingData) => {
        if(!trainingData.name) return toast.error("Dê um nome para a ficha.");

        const toastId = toast.loading('Salvando...');
        try {
            const payload = {
                coachId: user.uid, // Garante vínculo
                name: trainingData.name,
                description: trainingData.description || '',
                difficulty: trainingData.difficulty,
                updatedAt: serverTimestamp(),
                // Salva objeto desnormalizado para leitura rápida no app do aluno
                exercises: trainingData.exercises.map(ex => ({
                    firestoreId: ex.firestoreId || ex.id,
                    name: ex.name,
                    // Garante que a imagem seja salva, independente da origem
                    machineImage: ex.machineImage || null,
                    muscleGroup: ex.muscleGroup || '',
                    sets: ex.sets,
                    reps: ex.reps
                }))
            };

            if (trainingData.firestoreId) {
                await updateDoc(doc(db, 'trainings', trainingData.firestoreId), payload);
                toast.success('Ficha atualizada!', { id: toastId });
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, 'trainings'), payload);
                toast.success('Ficha criada!', { id: toastId });
            }
            
            setEditingTraining(null);
            fetchTrainings(); // Refresh na lista
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar.', { id: toastId });
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (await confirm({ title: "Excluir ficha", message: "Tem certeza? Alunos usando esta ficha perderão o acesso.", confirmLabel: "Excluir", danger: true })) {
            try {
                await deleteDoc(doc(db, 'trainings', id));
                setTrainings(prev => prev.filter(t => t.firestoreId !== id));
                toast.success("Ficha removida.");
            } catch (error) {
                toast.error("Erro ao remover.");
            }
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand"></div></div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8 pb-32">
        {dialog}
            <div className="max-w-5xl mx-auto space-y-6">
                
                {/* Header (Só aparece se não estiver editando, para limpar a tela) */}
                {!editingTraining && (
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in-down">
                        <div>
                            <button onClick={() => navigate('/coach/dashboard')} className="text-gray-500 hover:text-blue-500 text-sm font-bold mb-2">← Voltar</button>
                            <h1 className="text-3xl font-black text-gray-800 dark:text-white">Minhas Fichas 📋</h1>
                            <p className="text-gray-500 text-sm">Gerencie os treinos que seus alunos irão realizar.</p>
                        </div>
                        <button 
                            onClick={() => setEditingTraining({})}
                            className="bg-brand hover:bg-brand-dark text-black px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <span>+</span> Nova Ficha
                        </button>
                    </div>
                )}

                {/* Conteúdo Principal: Editor ou Lista */}
                {editingTraining ? (
                    <TrainingEditor 
                        training={editingTraining} 
                        onSave={handleSave} 
                        onCancel={() => setEditingTraining(null)} 
                    />
                ) : (
                    <>
                        {trainings.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <span className="text-4xl block mb-2 opacity-50">📝</span>
                                <p className="text-gray-500">Você ainda não criou nenhum treino.</p>
                                <button onClick={() => setEditingTraining({})} className="text-blue-600 font-bold mt-2 hover:underline">Criar a primeira</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
                                {trainings.map(t => (
                                    <div 
                                        key={t.firestoreId} 
                                        onClick={() => setEditingTraining(t)}
                                        className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer group hover:border-blue-300 transition-all relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${
                                                t.difficulty === 'Iniciante' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20' :
                                                t.difficulty === 'Intermediário' ? 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20' :
                                                'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20'
                                            }`}>
                                                {t.difficulty}
                                            </span>
                                            <button onClick={(e) => handleDelete(t.firestoreId, e)} className="text-gray-300 hover:text-red-500 p-1 transition-colors hover:bg-red-50 rounded">🗑</button>
                                        </div>
                                        
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1 group-hover:text-blue-600 transition-colors truncate">{t.name}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 h-8 mb-3">{t.description || "Sem descrição."}</p>
                                        
                                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-400 font-mono">
                                            <span className="font-bold text-gray-600 dark:text-gray-300">{t.exercises?.length || 0}</span> exercícios
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}