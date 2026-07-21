import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import toast from 'react-hot-toast';
import MonthCalendar from '../../components/dashboard/MonthCalendar';
import { useNavigate } from 'react-router-dom';
import { Clock, Dumbbell, Flame, Search, Trash2, ArrowUpRight } from 'lucide-react';

export default function HistoryPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros Locais
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'month', 'last_month'

  // 1. ARQUITETURA REAL-TIME (onSnapshot)
  useEffect(() => {
    if (!user) return;

    // Query Base
    const q = query(
      collection(db, 'checkIns'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    // Escuta ativa (Websocket)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data()
      }));
      setHistory(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro realtime:", error);
      toast.error('Erro de conexão com histórico.');
      setLoading(false);
    });

    return () => unsubscribe(); // Limpa listener ao desmontar
  }, [user]);

  // 2. LÓGICA DE FILTRO MEMOIZADA (Performance)
  const filteredHistory = useMemo(() => {
      let filtered = history;

      // Filtro de Texto (Busca profunda em nome do treino E exercícios)
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          filtered = filtered.filter(item => 
              (item.trainingName && item.trainingName.toLowerCase().includes(lowerTerm)) ||
              (item.exercises && item.exercises.some(ex => ex.name.toLowerCase().includes(lowerTerm)))
          );
      }

      // Filtro de Tempo
      const now = new Date();
      if (timeFilter === 'month') {
          filtered = filtered.filter(item => {
              const d = new Date(item.date);
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
      } else if (timeFilter === 'last_month') {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          filtered = filtered.filter(item => {
              const d = new Date(item.date);
              return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
          });
      }

      return filtered;
  }, [history, searchTerm, timeFilter]);

  // 3. UX DE DELEÇÃO (Toast Custom)
  const handleDeleteRequest = (itemId) => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <span className="font-bold text-sm">Apagar este registro?</span>
        <div className="flex gap-2">
            <button 
                onClick={() => {
                    deleteItem(itemId);
                    toast.dismiss(t.id);
                }}
                className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold"
            >
                Confirmar
            </button>
            <button 
                onClick={() => toast.dismiss(t.id)}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-xs font-bold"
            >
                Cancelar
            </button>
        </div>
      </div>
    ), { duration: 4000, icon: <Trash2 className="w-5 h-5 text-red-500" /> });
  };

  const deleteItem = async (itemId) => {
      try {
          await deleteDoc(doc(db, 'checkIns', itemId));
          toast.success('Registro apagado.');
      } catch (error) {
          toast.error('Erro ao apagar.');
      }
  };

  // Helpers de Formatação
  const formatDuration = (seconds) => {
    if (!seconds) return '0min';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const formatDate = (dateString) => {
      const d = new Date(dateString);
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return {
          day: d.getDate(),
          month: months[d.getMonth()],
          weekday: days[d.getDay()],
          full: d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
      };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 pb-32 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <div>
            <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">Histórico de Treinos</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Veja tudo o que você já realizou.</p>
        </div>

        {/* Calendário Mensal */}
        <MonthCalendar history={history} />

        {/* Barra de Filtros */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input 
                        type="text" 
                        placeholder="Buscar treino ou exercício..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white pl-9 pr-4 py-3 rounded-xl border border-gray-150 dark:border-gray-700 outline-none text-sm focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                    />
                </div>
                
                <select 
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                    className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-3 rounded-xl border border-gray-150 dark:border-gray-700 outline-none text-sm font-bold shadow-sm"
                >
                    <option value="all">Sempre</option>
                    <option value="month">Este Mês</option>
                    <option value="last_month">Mês Passado</option>
                </select>
            </div>
            
            {/* Contador de Resultados */}
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                {filteredHistory.length} {filteredHistory.length === 1 ? 'atividade encontrada' : 'atividades encontradas'}
            </div>
        </div>

        {/* Lista de Resultados */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center">
            <Search className="w-12 h-12 text-gray-400 mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-gray-700 dark:text-white">Nada encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Tente mudar os filtros.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredHistory.map((item) => {
                const dateObj = formatDate(item.date);
                
                return (
                  <div 
                    key={item.firestoreId} 
                    onClick={() => navigate(`/history/${item.firestoreId}`)}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-0 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group relative transition-all hover:shadow-md cursor-pointer"
                  >
                    {/* Header do Card */}
                    <div className="p-5 flex gap-5 border-b border-gray-50 dark:border-gray-700/50">
                        
                        {/* Data Box */}
                        <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700/50 rounded-xl min-w-[70px] h-[70px]">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{dateObj.month}</span>
                            <span className="text-2xl font-black text-gray-800 dark:text-white leading-none">{dateObj.day}</span>
                        </div>

                        {/* Infos Principais */}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-tight truncate pr-6">
                                {item.trainingName || 'Treino Sem Nome'}
                            </h3>
                            <p className="text-xs text-gray-400 capitalize mb-3">
                                {dateObj.full}
                            </p>
                            
                            {/* Badges */}
                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-2 py-1 rounded text-[10px] font-bold uppercase">
                                    <Clock className="w-3 h-3 text-blue-500" /> {formatDuration(item.duration)}
                                </span>
                                {item.totalVolume > 0 && (
                                    <span className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 px-2 py-1 rounded text-[10px] font-bold uppercase">
                                        <Dumbbell className="w-3 h-3 text-purple-500" /> {item.totalVolume}kg
                                    </span>
                                )}
                                {item.totalSetsDone !== undefined && (
                                    <span className="inline-flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-300 px-2 py-1 rounded text-[10px] font-bold uppercase">
                                        <Flame className="w-3 h-3 text-orange-500" /> {item.totalSetsDone} Sets
                                    </span>
                                )}
                            </div>
                        </div>
                        
                         {/* Botão Delete (Com stopPropagation) */}
                         <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRequest(item.firestoreId);
                            }}
                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Apagar registro"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Lista Expansível de Exercícios */}
                    {item.exercises && item.exercises.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Detalhes</p>
                            <div className="space-y-2">
                                {item.exercises.map((ex, i) => {
                                    const maxWeight = Math.max(...(ex.sets?.map(s => Number(s.weight) || 0) || [0]));
                                    
                                    return (
                                        <div 
                                            key={i} 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/analytics/${encodeURIComponent(ex.name)}`);
                                            }}
                                            className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-700/40 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer group transition-colors border border-transparent hover:border-blue-200 dark:hover:border-gray-600"
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 transition-colors truncate">
                                                    {ex.name}
                                                </span>
                                                <ArrowUpRight className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                            </div>
                                            
                                            <div className="text-right flex items-center gap-3 shrink-0">
                                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                    {ex.sets?.length || 0} sets
                                                </span>
                                                {maxWeight > 0 && (
                                                    <span className="text-xs font-bold text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded">
                                                        {maxWeight}kg
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                  </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );
}