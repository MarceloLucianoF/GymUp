import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../hooks/useAdmin';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { Dumbbell, Footprints, Flame, Zap, Activity, Rocket, Clock, ChevronRight, ChevronDown, ClipboardList, Package, Layers } from 'lucide-react';

// --- COMPONENTES VISUAIS ---

const TrainingSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 h-48 border border-gray-100 dark:border-gray-700 animate-pulse flex flex-col justify-between">
    <div className="flex justify-between">
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
      <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
    </div>
    <div className="space-y-2">
      <div className="w-3/4 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="w-1/2 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
    <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>
    <div className="flex justify-between">
      <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  </div>
);

const FilterChip = ({ label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
      active 
      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' 
      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400'
    }`}
  >
    {label}
  </button>
);

export default function TrainingsPage() {
  const { trainings, loading: loadingTrainings, error } = useAdmin();
  const { user } = useAuthContext();
  
  const [historyMap, setHistoryMap] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [filter, setFilter] = useState('Todos');
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [collapsedPackages, setCollapsedPackages] = useState({});

  // 1. Busca Histórico
  useEffect(() => {
    const fetchUserHistory = async () => {
      if (!user) return;
      try {
        const q = query(
            collection(db, 'checkIns'), 
            where('userId', '==', user.uid),
            orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        const history = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.trainingId && !history[data.trainingId]) {
                history[data.trainingId] = new Date(data.date);
            }
        });
        setHistoryMap(history);
      } catch (err) {
        console.error("Erro history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchUserHistory();
  }, [user]);

  // 2. Busca Pacotes de Treino
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const q = query(collection(db, 'trainingPackages'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const pkgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPackages(pkgs);
      } catch (err) {
        console.error("Erro ao buscar pacotes:", err);
      } finally {
        setLoadingPackages(false);
      }
    };
    fetchPackages();
  }, []);

  // 3. Helpers
  const getTrainingIconComponent = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('peito') || lower.includes('superior')) return Dumbbell;
    if (lower.includes('perna') || lower.includes('inferior') || lower.includes('glúteo')) return Footprints;
    if (lower.includes('costas') || lower.includes('dorsal')) return Activity;
    if (lower.includes('braço') || lower.includes('bíceps') || lower.includes('tríceps')) return Dumbbell;
    if (lower.includes('cardio') || lower.includes('aeróbico')) return Activity;
    if (lower.includes('full') || lower.includes('corpo')) return Zap;
    
    const match = (name || '').match(/Treino\s+([A-Z])/i);
    const letter = match ? match[1].toUpperCase() : '';
    const map = { 'A': Flame, 'B': Zap, 'C': Dumbbell, 'D': Activity, 'E': Rocket };
    return map[letter] || Dumbbell;
  };

  const getDifficultyColor = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'iniciante': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'intermediário': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'avançado': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const formatLastDone = (date) => {
      if (!date) return null;
      const diff = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'Hoje';
      if (diff === 1) return 'Ontem';
      if (diff < 7) return `Há ${diff} dias`;
      return date.toLocaleDateString('pt-BR');
  };

  const togglePackageCollapse = (pkgId) => {
    setCollapsedPackages(prev => ({ ...prev, [pkgId]: !prev[pkgId] }));
  };

  // 4. Processamento
  const isLoading = loadingTrainings || loadingHistory || loadingPackages;

  const filteredTrainings = trainings.filter(t => {
      if (filter === 'Todos') return true;
      return t.difficulty?.toLowerCase() === filter.toLowerCase();
  });

  // Agrupar por packageId
  const packagedTrainings = {};
  const looseTrainings = [];
  
  filteredTrainings.forEach(t => {
    const validId = t.id || t.firestoreId;
    if (!validId) return;
    
    const trainingWithId = { ...t, _validId: validId };
    
    if (t.packageId) {
      if (!packagedTrainings[t.packageId]) {
        packagedTrainings[t.packageId] = [];
      }
      packagedTrainings[t.packageId].push(trainingWithId);
    } else {
      looseTrainings.push(trainingWithId);
    }
  });

  // Ordenar treinos dentro de cada pacote pelo campo order
  Object.keys(packagedTrainings).forEach(pkgId => {
    packagedTrainings[pkgId].sort((a, b) => (a.order || 0) - (b.order || 0));
  });

  // Renderizar card de treino individual
  const renderTrainingCard = (training) => {
    const validId = training._validId;
    const lastDate = historyMap[validId];
    const lastDoneText = formatLastDone(lastDate);
    const IconComponent = getTrainingIconComponent(training.name);
    const estimatedTime = (training.exercises?.length || 0) * 5 + 10; 

    return (
      <Link 
        to={`/training/${validId}`} 
        key={validId} 
        className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-800/80"
      >
        {/* Badge Recomendado */}
        {(!lastDate || (new Date() - lastDate) / (1000 * 60 * 60 * 24) > 7) && (
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl shadow-lg z-10">
                RECOMENDADO
            </div>
        )}

        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform group-hover:bg-white dark:group-hover:bg-gray-600">
                  <IconComponent className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:text-blue-500" />
              </div>
              
              <div className="text-right">
                  <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border mb-1 ${getDifficultyColor(training.difficulty)}`}>
                      {training.difficulty || 'Geral'}
                  </span>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                      {lastDoneText ? `Última: ${lastDoneText}` : 'Nunca realizado'}
                  </p>
              </div>
          </div>

          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">
              {training.name || 'Treino Sem Nome'}
          </h3>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-4">
              {training.day ? `${training.day} • ` : ''}{training.description || "Foco total no desenvolvimento muscular."}
          </p>

          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                      <ClipboardList className="w-3.5 h-3.5 text-gray-500" /> {training.exercises?.length || 0}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-gray-500" /> ~{estimatedTime} min
                  </div>
              </div>
              
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4" />
              </div>
          </div>
        </div>
      </Link>
    );
  };

  if (error) return <div className="min-h-screen flex items-center justify-center dark:text-white">Erro: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
            <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight mb-2">
                Fichas de Treino
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
                Escolha sua missão. Organizado por pacotes para você.
            </p>

            {/* Filtros */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['Todos', 'Iniciante', 'Intermediário', 'Avançado'].map(f => (
                    <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
                ))}
            </div>
        </div>
        
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1,2,3,4].map(i => <TrainingSkeleton key={i} />)}
            </div>
        ) : (
          <div className="space-y-8">
            
            {/* Pacotes de Treino */}
            {packages.map(pkg => {
              const pkgTrainings = packagedTrainings[pkg.id] || [];
              if (pkgTrainings.length === 0) return null;
              
              const isCollapsed = collapsedPackages[pkg.id];
              
              return (
                <div key={pkg.id} className="space-y-4">
                  {/* Package Header */}
                  <button
                    onClick={() => togglePackageCollapse(pkg.id)}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-2xl p-5 shadow-lg shadow-blue-600/10 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                          <Package className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-black text-white leading-tight">{pkg.name}</h2>
                          <p className="text-blue-100 text-sm mt-0.5 line-clamp-1">{pkg.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2">
                          {pkg.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] font-bold text-white/80 bg-white/15 px-2.5 py-1 rounded-full backdrop-blur-sm">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-white/80">
                          <span className="text-sm font-bold">{pkgTrainings.length} treinos</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`} />
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Training Cards Grid (collapsible) */}
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in pl-2">
                      {pkgTrainings.map(training => renderTrainingCard(training))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Treinos Avulsos (sem pacote) */}
            {looseTrainings.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <Layers className="w-5 h-5 text-gray-400" />
                  <h2 className="text-lg font-bold text-gray-600 dark:text-gray-300">Treinos Avulsos</h2>
                  <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {looseTrainings.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {looseTrainings.map(training => renderTrainingCard(training))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {Object.keys(packagedTrainings).length === 0 && looseTrainings.length === 0 && (
              <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-bold">Nenhum treino encontrado.</p>
                <p className="text-gray-400 text-sm mt-1">Aplique os filtros ou aguarde o treinador criar seus pacotes.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}