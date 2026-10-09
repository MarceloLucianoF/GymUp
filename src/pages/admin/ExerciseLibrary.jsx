import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/common/Modal';
import { SkeletonList } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function ExerciseLibrary() {
  const { confirm, dialog } = useConfirm();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [newExercise, setNewExercise] = useState({
    name: '',
    muscleGroup: 'Peito',
    demoUrl: '', // URL da imagem/gif
    equipment: 'Máquina'
  });

  // Carregar Exercícios
  useEffect(() => {
    const fetchExercises = async () => {
      setError(false);
      try {
        // Busca exercícios globais (do sistema) ou criados pelo coach
        // Para MVP, vamos puxar tudo, mas idealmente seria filtrado
        const q = query(collection(db, 'exercises'), orderBy('name'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setExercises(list);
      } catch (error) {
        console.error(error);
        setError(true);
        toast.error("Erro ao carregar biblioteca.");
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, [user, reloadKey]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newExercise.name) return toast.error("Nome é obrigatório");

    const toastId = toast.loading("Salvando...");
    try {
      const docData = {
        ...newExercise,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'exercises'), docData);
      
      setExercises(prev => [...prev, { id: docRef.id, ...docData }]);
      setNewExercise({ name: '', muscleGroup: 'Peito', demoUrl: '', equipment: 'Máquina' });
      setShowModal(false);
      toast.success("Exercício criado!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar.", { id: toastId });
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm({ title: "Excluir exercício", message: "Tem certeza? Isso pode quebrar treinos existentes.", confirmLabel: "Excluir", danger: true }))) return;
    try {
        await deleteDoc(doc(db, 'exercises', id));
        setExercises(prev => prev.filter(ex => ex.id !== id));
        toast.success("Exercício removido.");
    } catch (error) {
        toast.error("Erro ao remover.");
    }
  };

  // Filtro
  const filtered = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ex.muscleGroup.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6"><SkeletonList count={4} itemClassName="h-24 w-full" /></div>;

  if (error) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6"><ErrorState onRetry={() => { setLoading(true); setReloadKey(k => k + 1); }} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8">
    {dialog}
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <button onClick={() => navigate('/coach/dashboard')} className="text-gray-500 hover:text-blue-500 text-sm font-bold mb-2">← Voltar ao Painel</button>
                <h1 className="text-3xl font-black text-gray-800 dark:text-white">Biblioteca de Exercícios 📚</h1>
                <p className="text-gray-500 text-sm">Gerencie os movimentos disponíveis para seus treinos.</p>
            </div>
            <button 
                onClick={() => setShowModal(true)}
                className="bg-brand hover:bg-brand-dark text-black px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95"
            >
                <span>+</span> Novo Exercício
            </button>
        </div>

        {/* Busca */}
        <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
                type="text" 
                placeholder="Buscar por nome ou grupo muscular..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            />
        </div>

        {/* Grid de Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(ex => (
                <div key={ex.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 group hover:border-blue-300 transition-colors">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0">
                        {ex.demoUrl ? (
                            <img src={ex.demoUrl} alt={ex.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">💪</div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 dark:text-white truncate">{ex.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded font-bold uppercase">{ex.muscleGroup}</span>
                            <span className="text-[10px] text-gray-400">{ex.equipment}</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleDelete(ex.id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                        🗑️
                    </button>
                </div>
            ))}
        </div>

        {filtered.length === 0 && (
            <EmptyState title="Nenhum exercício encontrado." description={searchTerm ? 'Tente outro termo de busca.' : 'Cadastre o primeiro exercício da biblioteca.'} />
        )}

        {/* MODAL DE CRIAÇÃO */}
        {showModal && (
            <Modal onClose={() => setShowModal(false)} label="Novo exercício" className="w-full max-w-lg">
                <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl p-8 shadow-2xl relative">
                    <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600">✕</button>
                    
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-6">Novo Exercício</h2>
                    
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nome do Exercício</label>
                            <input 
                                required
                                value={newExercise.name}
                                onChange={(e) => setNewExercise({...newExercise, name: e.target.value})}
                                placeholder="Ex: Supino Inclinado"
                                className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Grupo Muscular</label>
                                <select 
                                    value={newExercise.muscleGroup}
                                    onChange={(e) => setNewExercise({...newExercise, muscleGroup: e.target.value})}
                                    className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white cursor-pointer"
                                >
                                    {['Peito', 'Costas', 'Pernas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen', 'Cardio', 'Full Body'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Equipamento</label>
                                <input 
                                    value={newExercise.equipment}
                                    onChange={(e) => setNewExercise({...newExercise, equipment: e.target.value})}
                                    placeholder="Ex: Halteres"
                                    className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">URL da Imagem / GIF (Opcional)</label>
                            <input 
                                value={newExercise.demoUrl}
                                onChange={(e) => setNewExercise({...newExercise, demoUrl: e.target.value})}
                                placeholder="https://..."
                                className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white text-sm font-mono"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Cole um link direto de imagem ou GIF para ilustrar o movimento.</p>
                        </div>

                        <button 
                            type="submit" 
                            className="w-full bg-brand hover:bg-brand-dark text-black font-bold py-4 rounded-xl shadow-lg mt-4 transition-transform active:scale-95"
                        >
                            Salvar Exercício
                        </button>
                    </form>
                </div>
            </Modal>
        )}

      </div>
    </div>
  );
}