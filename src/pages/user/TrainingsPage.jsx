import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { useAdmin } from '../../hooks/useAdmin';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { Dumbbell, Footprints, Flame, Zap, Activity, Rocket, Clock, ChevronRight, ChevronDown, ClipboardList, Package, Layers, Sparkles, Search, FilePlus2, Trash2, Pencil, ListChecks, Copy, Share2, ListOrdered } from 'lucide-react';
import toast from 'react-hot-toast';
import { sameDifficulty } from '../../utils/exerciseKind';
import MyWorkoutModal from '../../components/training/MyWorkoutModal';
import { deleteMyWorkout, listMyWorkoutsAndRoutine, saveMyRoutine, saveMyWorkout } from '../../services/myWorkouts';
import RoutineModal from '../../components/training/RoutineModal';
import { sortByRoutine } from '../../utils/routine';
import { duplicatePayload, workoutShareText } from '../../utils/workoutShare';
import { listMyExercises, myExerciseToLibrary } from '../../services/myExercises';
import { isSafePhoto } from '../../utils/imageAttach';
import AICoachModal from '../../components/ai/AICoachModal';
import { formatDate } from '../../utils/format';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ChipRow from '../../components/dashboard/ChipRow';
import { fetchStudentCheckIns } from '../../services/checkInsCache';
import { plural } from '../../utils/text';

// --- COMPONENTES VISUAIS ---

const TrainingSkeleton = () => (
  <div className="surface skeleton-shimmer p-6 h-48 flex flex-col justify-between">
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

// Abas do topo: os treinos do aluno ficam separados dos treinos prontos da loja.
const MINE = 'Meus treinos';
const READY = 'Prontos';

export default function TrainingsPage() {
  const { trainings, trainingsLoading, trainingsError, refreshData } = useAdmin();
  const { user, userProfile } = useAuthContext();
  
  const [historyMap, setHistoryMap] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(true);
  // Escolha do aluno nas abas (Meus treinos, Prontos, dificuldade). Sem escolha, abre em Meus treinos quando ele já tem treino próprio.
  const [filterPref, setFilter] = useState(null);
  const [mineLoaded, setMineLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [packagesError, setPackagesError] = useState(false);
  const [packagesReload, setPackagesReload] = useState(0);
  const [collapsedPackages, setCollapsedPackages] = useState({});
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isMineOpen, setIsMineOpen] = useState(false);
  const [mine, setMine] = useState([]);
  const [mineReload, setMineReload] = useState(0);
  const [editingMine, setEditingMine] = useState(null);
  const [myExercises, setMyExercises] = useState([]);
  // Minha ficha: ordem (A, B, C...) e dia opcional dos treinos pessoais.
  const [routine, setRoutine] = useState([]);
  const [isRoutineOpen, setIsRoutineOpen] = useState(false);

  // Treinos pessoais (privados): digitados ou importados de PDF. Não vêm da loja de fichas.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    listMyWorkoutsAndRoutine(user.uid).then(({ workouts, routine: r }) => { if (alive) { setMine(workouts); setRoutine(r.items); } }).catch((err) => console.error('Erro ao buscar meus treinos:', err)).finally(() => { if (alive) setMineLoaded(true); });
    listMyExercises(user.uid).then((rows) => { if (alive) setMyExercises(rows); }).catch(() => {});
    return () => { alive = false; };
  }, [user, mineReload]);

  const duplicateMine = async (training) => {
    try { await saveMyWorkout(user.uid, duplicatePayload(training)); setMineReload((n) => n + 1); toast.success('Treino duplicado.'); } catch { toast.error('Não consegui duplicar o treino.'); }
  };

  const shareMine = async (training) => {
    const text = workoutShareText(training);
    try {
      if (navigator.share) { await navigator.share({ title: training.name, text }); return; }
      await navigator.clipboard.writeText(text);
      toast.success('Treino copiado. É só colar onde quiser.');
    } catch (e) {
      if (e?.name === 'AbortError') return;
      toast.error('Não consegui compartilhar.');
    }
  };

  const saveRoutine = async (items) => {
    try { setRoutine(await saveMyRoutine(user.uid, items)); setIsRoutineOpen(false); toast.success(items.length ? 'Ficha salva.' : 'Ficha esvaziada.'); } catch { toast.error('Não consegui salvar a ficha.'); }
  };

  const removeMine = async (training) => {
    if (!window.confirm(`Apagar o treino "${training.name}"?`)) return;
    try { await deleteMyWorkout(user.uid, training.docId); setMineReload((n) => n + 1); toast.success('Treino apagado.'); } catch { toast.error('Não consegui apagar o treino.'); }
  };

  // 1. Busca Histórico
  useEffect(() => {
    const fetchUserHistory = async () => {
      if (!user) return;
      try {
        const rows = await fetchStudentCheckIns(user.uid);
        const history = {};
        rows.forEach((data) => {
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
      setPackagesError(false);
      try {
        const q = query(collection(db, 'trainingPackages'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const pkgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPackages(pkgs);
      } catch (err) {
        console.error("Erro ao buscar pacotes:", err);
        setPackagesError(true);
      } finally {
        setLoadingPackages(false);
      }
    };
    fetchPackages();
  }, [packagesReload]);

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
    switch ((diff || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()) {
      case 'iniciante': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'intermediario': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'avancado': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const formatLastDone = (date) => {
      if (!date) return null;
      const diff = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'Hoje';
      if (diff === 1) return 'Ontem';
      if (diff < 7) return `Há ${diff} dias`;
      return formatDate(date);
  };

  const togglePackageCollapse = (pkgId) => {
    setCollapsedPackages(prev => ({ ...prev, [pkgId]: !prev[pkgId] }));
  };

  // 4. Processamento
  const isLoading = trainingsLoading || loadingHistory || loadingPackages || !mineLoaded;
  const filter = filterPref ?? (mine.length > 0 ? MINE : READY);

  const term = searchTerm.trim().toLowerCase();
  const filteredTrainings = trainings.filter(t => {
      if (filter !== READY && !sameDifficulty(t.difficulty, filter)) return false;
      if (!term) return true;
      return (t.name || '').toLowerCase().includes(term) ||
        (t.description || '').toLowerCase().includes(term) ||
        (t.exercises || []).some(ex => (ex.name || '').toLowerCase().includes(term));
  });

  const mineFiltered = sortByRoutine(mine, routine).filter((t) => !term
    || (t.name || '').toLowerCase().includes(term)
    || (t.description || '').toLowerCase().includes(term)
    || (t.exercises || []).some((ex) => (ex.name || '').toLowerCase().includes(term)));

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
  const renderTrainingCard = (training, index = 0, { own = false } = {}) => {
    const validId = training._validId;
    const lastDate = historyMap[validId];
    const lastDoneText = formatLastDone(lastDate);
    const IconComponent = getTrainingIconComponent(training.name);
    const estimatedTime = (training.exercises?.length || 0) * 5 + 10; 

    return (
      <Link 
        to={`/training/${validId}`} 
        key={validId} 
        style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
        className="surface surface-hover pressable animate-fade-up group relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {/* Badge Recomendado */}
        {!own && (!lastDate || (new Date() - lastDate) / (1000 * 60 * 60 * 24) > 7) && (
            <div className="absolute top-0 right-0 bg-brand text-black text-[9px] font-bold px-3 py-1 rounded-bl-xl shadow-lg z-10">
                RECOMENDADO
            </div>
        )}

        {isSafePhoto(training.photo) && <img src={training.photo} alt={`Foto de ${training.name || 'treino'}`} className="h-32 w-full object-cover" loading="lazy" />}
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-900/60 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform group-hover:bg-white dark:group-hover:bg-[#1F2937]">
                  <IconComponent className="w-6 h-6 text-brand dark:text-brand group-hover:text-brand-dark" />
              </div>
              
              <div className="text-right">
                  {training.routineLetter && <span className="mr-1 inline-block rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black mb-1">Treino {training.routineLetter}</span>}
                  <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border mb-1 ${getDifficultyColor(training.difficulty)}`}>
                      {training.difficulty || 'Geral'}
                  </span>
                  <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">
                      {lastDoneText ? `Última: ${lastDoneText}` : 'Nunca realizado'}
                  </p>
              </div>
          </div>

          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1 group-hover:text-brand-dark transition-colors line-clamp-1">
              {training.name || 'Treino sem nome'}
          </h3>
          
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-4">
              {training.day ? `${training.day} • ` : ''}{training.description || "Foco total no desenvolvimento muscular."}
          </p>

          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-900/60 px-2 py-1 rounded-lg">
                      <ClipboardList className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" /> {training.exercises?.length || 0}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-900/60 px-2 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" /> ~{estimatedTime} min
                  </div>
              </div>
              
              <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-brand/10 flex items-center justify-center text-brand group-hover:bg-brand group-hover:text-black transition-all duration-300 group-hover:scale-110 active:scale-95 shadow-sm">
                  <ChevronRight className="w-4 h-4" />
              </div>
          </div>
        </div>
      </Link>
    );
  };

  if (trainingsError || packagesError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-6">
        <ErrorState
          message={trainingsError || 'Não foi possível carregar os pacotes de treino.'}
          onRetry={() => {
            setLoadingPackages(true);
            setPackagesReload(k => k + 1);
            refreshData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 sm:p-6 pb-32 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
            <PageHeader
              eyebrow="Biblioteca"
              title="Fichas de treino"
              subtitle="Escolha sua missão ou gere uma ficha inteligente por IA."
              actions={
                <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setIsMineOpen(true)}
                    aria-label="Cadastrar meu treino"
                    className="pressable min-h-[44px] px-4 text-xs font-black rounded-2xl bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white shrink-0 inline-flex items-center gap-2"
                >
                    <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                    Meu treino
                </button>
                <Link
                    to="/meus-exercicios"
                    className="pressable min-h-[44px] px-4 text-xs font-black rounded-2xl bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white shrink-0 inline-flex items-center gap-2"
                >
                    <ListChecks className="w-4 h-4" aria-hidden="true" />
                    Meus exercícios
                </Link>
                <button
                    type="button"
                    onClick={() => setIsAIModalOpen(true)}
                    aria-label="Gerar treino com IA"
                    className="btn-primary-gradient pressable min-h-[44px] px-4 text-xs font-black shadow-lg shadow-brand/20 shrink-0"
                >
                    <Sparkles className="w-4 h-4 fill-current" aria-hidden="true" />
                    Gerar com IA
                </button>
                </div>
              }
            />

            {/* Busca + Filtros */}
            <div className="relative mb-3">
                <Search className="w-4 h-4 text-gray-600 dark:text-gray-400 pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={filter === MINE ? 'Buscar nos meus treinos...' : 'Buscar ficha ou exercício...'}
                    aria-label={filter === MINE ? 'Buscar nos meus treinos' : 'Buscar ficha ou exercício'}
                    className="w-full input-brand-dark !pl-11 pr-4 text-base"
                />
            </div>
            <ChipRow
                label="Filtrar treinos"
                value={filter}
                onChange={setFilter}
                options={[MINE, READY, 'Iniciante', 'Intermediário', 'Avançado'].map(f => ({ value: f, label: f }))}
            />
        </div>
        
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1,2,3,4].map(i => <TrainingSkeleton key={i} />)}
            </div>
        ) : (
          <div className="space-y-8">
            {filter === MINE ? (
            /* Meus treinos: privados, só do aluno. Os treinos prontos ficam nas outras abas. */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
                <Dumbbell className="w-5 h-5 text-brand" aria-hidden="true" />
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Meus treinos</h2>
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{mine.length}</span>
                {mine.length > 0 && (
                  <button type="button" onClick={() => setIsRoutineOpen(true)} className="pressable ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-brand/15 px-3 text-xs font-black text-amber-900 dark:text-brand">
                    <ListOrdered className="w-4 h-4" aria-hidden="true" />{routine.length ? 'Organizar ficha' : 'Montar minha ficha'}
                  </button>
                )}
              </div>
              {mine.length > 1 && routine.length === 0 && (
                <p className="px-1 text-sm text-gray-600 dark:text-gray-300">Monte sua ficha para definir a ordem da semana (Treino A, B, C...). A Home passa a sugerir o próximo.</p>
              )}
              {mine.length === 0 ? (
                <button type="button" onClick={() => setIsMineOpen(true)} className="surface pressable w-full p-5 text-left">
                  <p className="font-bold text-gray-800 dark:text-white">Cadastre o treino que você já usa</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Importe um PDF ou monte do zero com os aparelhos que a sua academia tem. Só você vê.</p>
                </button>
              ) : mineFiltered.length === 0 ? (
                <EmptyState icon={Package} title="Nenhum treino seu com esse nome." description="Tente outra busca." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mineFiltered.map((t, i) => (
                    <div key={t.id} className="flex flex-col gap-2 [&>a]:flex-1">
                      {renderTrainingCard({ ...t, _validId: t.id, difficulty: 'Meu treino' }, i, { own: true })}
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setEditingMine({ docId: t.docId, workout: t })} aria-label={`Editar ${t.name}`} className="pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gray-100 text-sm font-bold text-gray-800 dark:bg-white/10 dark:text-white"><Pencil className="w-4 h-4" aria-hidden="true" />Editar</button>
                        <button type="button" onClick={() => duplicateMine(t)} aria-label={`Duplicar ${t.name}`} className="pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gray-100 text-sm font-bold text-gray-800 dark:bg-white/10 dark:text-white"><Copy className="w-4 h-4" aria-hidden="true" />Duplicar</button>
                        <button type="button" onClick={() => shareMine(t)} aria-label={`Compartilhar ${t.name}`} className="pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gray-100 text-sm font-bold text-gray-800 dark:bg-white/10 dark:text-white"><Share2 className="w-4 h-4" aria-hidden="true" />Compartilhar</button>
                        <button type="button" onClick={() => removeMine(t)} aria-label={`Apagar ${t.name}`} className="pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-red-100 text-sm font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300"><Trash2 className="w-4 h-4" aria-hidden="true" />Apagar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : (<>
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
                    aria-expanded={!isCollapsed}
                    className="pressable w-full min-h-[64px] bg-gradient-to-r from-gray-900 to-[#1F2937] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-lg hover:border-brand/45 transition-all text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 shrink-0 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                          <Package className="w-6 h-6 text-brand" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-white leading-tight">{pkg.name}</h2>
                          <p className="text-gray-300 text-sm mt-0.5 line-clamp-1">{pkg.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-2">
                          {pkg.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] font-bold text-white/80 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-white/80">
                          <span className="text-sm font-bold whitespace-nowrap">{plural(pkgTrainings.length, 'treino', 'treinos')}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`} />
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Training Cards Grid (collapsible) */}
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in ">
                      {pkgTrainings.map((training, i) => renderTrainingCard(training, i))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Treinos Avulsos (sem pacote) */}
            {looseTrainings.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <Layers className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h2 className="text-lg font-bold text-gray-600 dark:text-gray-300">Treinos avulsos</h2>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {looseTrainings.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {looseTrainings.map((training, i) => renderTrainingCard(training, i))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {Object.keys(packagedTrainings).length === 0 && looseTrainings.length === 0 && (
              <EmptyState
                icon={Package}
                title="Nenhum treino encontrado."
                description="Aplique os filtros ou aguarde o treinador criar seus pacotes."
              />
            )}
            </>)}
          </div>
        )}
      </div>

      {isRoutineOpen && <RoutineModal workouts={mine} items={routine} onClose={() => setIsRoutineOpen(false)} onSave={saveRoutine} />}

      <MyWorkoutModal isOpen={isMineOpen || !!editingMine} editing={editingMine} myExercises={myExercises} onClose={() => { setIsMineOpen(false); setEditingMine(null); }} user={user} onSaved={() => setMineReload((n) => n + 1)} />

      {/* MODAL DO COACH IA */}
      <AICoachModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        userProfile={userProfile}
        user={user}
        customExercises={myExercises.map(myExerciseToLibrary)}
        onWorkoutSaved={() => {
          if (refreshData) refreshData();
          setMineReload((n) => n + 1);   // o treino da IA é salvo em "Meus treinos": recarrega a lista
        }}
      />
    </div>
  );
}