import React, { useState, useEffect, useMemo } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { collection, query, where, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import { Camera, Scale, TrendingDown, X, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { formatDate } from '../../utils/format';
import Modal from '../../components/common/Modal';
import { SkeletonList } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

// --- SUB-COMPONENTES ---

// 1. Gráfico de Peso (Custom SVG)
const WeightChart = ({ data }) => {
  if (!data || data.length < 2) return (
    <div className="surface h-48 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 border-dashed">
        <TrendingDown className="w-8 h-8 mb-2 opacity-60" aria-hidden="true" />
        <p className="text-sm">Registre pelo menos 2 pesagens.</p>
    </div>
  );

  const height = 180;
  const width = 320;
  const paddingX = 24;
  const paddingY = 24;

  const weights = data.map(d => Number(d.weight) || 0);
  const realMin = Math.min(...weights);
  const realMax = Math.max(...weights);
  let minW = realMin;
  let maxW = realMax;
  if (minW === maxW) { minW -= 5; maxW += 5; }
  else { const spread = maxW - minW; minW -= spread * 0.15; maxW += spread * 0.15; }
  const range = maxW - minW;

  const getX = (i) => paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
  const getY = (val) => (height - paddingY) - ((val - minW) / range) * (height - paddingY * 2);

  const pts = weights.map((w, i) => [getX(i), getY(w)]);
  const linePath = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1][0]},${height - paddingY} L${pts[0][0]},${height - paddingY} Z`;
  const last = pts[pts.length - 1];
  const diff = weights[weights.length - 1] - weights[0];

  return (
    <div className="surface w-full p-4 sm:p-5 overflow-hidden animate-fade-up">
      <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Histórico de peso</h3>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${diff <= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
          </span>
      </div>
      <div className="w-full relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible" role="img" aria-label={`Gráfico de peso: de ${weights[0]} kg para ${weights[weights.length - 1]} kg`}>
            <defs>
                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFC107" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#FFC107" stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0, 0.5, 1].map((f) => {
              const y = paddingY + f * (height - paddingY * 2);
              return <line key={f} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="4" className="text-gray-300 dark:text-white/10" />;
            })}
            <text x={paddingX} y={paddingY - 8} fontSize="10" className="fill-gray-500 dark:fill-gray-400" fontWeight="700">{realMax}kg</text>
            <text x={paddingX} y={height - paddingY + 14} fontSize="10" className="fill-gray-500 dark:fill-gray-400" fontWeight="700">{realMin}kg</text>

            <path d={areaPath} fill="url(#weightGradient)" className="animate-fade-in" />
            <path d={linePath} fill="none" stroke="#FFC107" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              pathLength="1" strokeDasharray="1" style={{ '--len': 1 }} className="animate-draw" />
            {pts.map(([x, y], i) => (
               <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3} className="fill-white dark:fill-gray-900 animate-scale-in" stroke="#FFC107" strokeWidth="2" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${600 + i * 40}ms` }} />
            ))}
            <circle cx={last[0]} cy={last[1]} r="9" fill="#FFC107" opacity="0.25" className="animate-pulse" />
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-2 font-mono uppercase">
         <span>{formatDate(data[0].date)}</span>
         <span>{formatDate(data[data.length-1].date)}</span>
      </div>
    </div>
  );
};

// 2. Modal de Adicionar Medida
const AddMeasurementModal = ({ onClose, onSave }) => {
    const [weight, setWeight] = useState('');
    const [photo, setPhoto] = useState(null);
    const [preview, setPreview] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500 * 1024) { // 500KB limit
                toast.error("Foto muito grande (Max 500KB)");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhoto(reader.result);
                setPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!weight) return;
        setIsSaving(true);
        await onSave({ weight: parseFloat(weight.replace(',', '.')), photo });
        setIsSaving(false);
    };

    return (
        <Modal onClose={onClose} label="Registrar medidas" className="w-full max-w-sm">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
                <button aria-label="Fechar" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                </button>
                
                <h2 className="text-xl font-black text-gray-800 dark:text-white mb-6">Nova Medição</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Peso Atual (kg)</label>
                        <input 
                            autoFocus
                            type="number" 
                            inputMode="decimal"
                            value={weight}
                            onChange={e => setWeight(e.target.value)}
                            placeholder="00.0"
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl p-4 text-3xl font-black text-center text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Foto do Shape (Opcional)</label>
                        <div className="flex justify-center">
                            <label className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative overflow-hidden">
                                {preview ? (
                                    <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <Camera className="w-6 h-6 text-gray-400 mb-1" />
                                        <span className="text-xs text-gray-400">Clique para enviar</span>
                                    </>
                                )}
                                <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                            </label>
                        </div>
                    </div>

                    <button 
                        disabled={!weight || isSaving}
                        type="submit" 
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] disabled:opacity-50"
                    >
                        {isSaving ? 'Salvando...' : 'Registrar Evolução'}
                    </button>
                </form>
            </div>
        </Modal>
    );
};

// --- PÁGINA PRINCIPAL ---

export default function MeasurementsPage() {
  const { confirm, dialog } = useConfirm();
  const { user } = useAuthContext();
  
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [userHeight, setUserHeight] = useState(null);

  // 1. Carrega histórico e Altura do Perfil
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setError(false);
      try {
        // Busca Medidas
        const q = query(
            collection(db, 'measurements'), 
            where('userId', '==', user.uid),
            orderBy('date', 'asc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMeasurements(data);

        // Busca Altura para IMC
        const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
        if (!userDoc.empty) {
            setUserHeight(userDoc.docs[0].data().height);
        }

      } catch (error) {
        console.error("Erro medidas:", error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, reloadKey]);

  // 2. Salvar Nova Medida
  const handleSaveMeasurement = async (data) => {
    try {
        const newEntry = {
            userId: user.uid,
            weight: data.weight,
            photo: data.photo || null,
            date: new Date().toISOString(),
            type: 'weight'
        };

        const docRef = await addDoc(collection(db, 'measurements'), newEntry);
        
        // Sincroniza com Perfil do Usuário
        await updateDoc(doc(db, 'users', user.uid), { weight: data.weight });

        setMeasurements([...measurements, { id: docRef.id, ...newEntry }]);
        setShowModal(false);
        toast.success('Evolução registrada!');
    } catch (error) {
        console.error(error);
        toast.error('Erro ao salvar.');
    }
  };

  const handleDelete = async (id) => {
      if (await confirm({ title: "Apagar registro", message: "Apagar este registro?", confirmLabel: "Apagar", danger: true })) {
          try {
              await deleteDoc(doc(db, 'measurements', id));
              setMeasurements(prev => prev.filter(m => m.id !== id));
              toast.success("Apagado.");
          } catch(e) { toast.error("Erro ao apagar"); }
      }
  };

  // 3. Cálculos e Stats
  const stats = useMemo(() => {
      if (measurements.length === 0) return null;
      
      const current = measurements[measurements.length - 1].weight;
      const start = measurements[0].weight;
      const diff = current - start;
      
      // IMC
      let imc = null;
      let imcLabel = '';
      let imcColor = 'text-gray-500';
      
      if (userHeight) {
          const h = userHeight / 100;
          imc = (current / (h * h)).toFixed(1);
          if (imc < 18.5) { imcLabel = 'Abaixo'; imcColor = 'text-yellow-500'; }
          else if (imc < 25) { imcLabel = 'Normal'; imcColor = 'text-green-500'; }
          else if (imc < 30) { imcLabel = 'Sobrepeso'; imcColor = 'text-orange-500'; }
          else { imcLabel = 'Obesidade'; imcColor = 'text-red-500'; }
      }

      return {
          current,
          start,
          diff: diff.toFixed(1),
          diffSign: diff > 0 ? '+' : '',
          imc,
          imcLabel,
          imcColor
      };
  }, [measurements, userHeight]);

  // Filtra apenas medidas com fotos para a galeria
  const galleryPhotos = measurements.filter(m => m.photo).reverse();

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4"><SkeletonList count={4} itemClassName="h-24 w-full" /></div>;

  if (error) return <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4"><ErrorState onRetry={() => { setLoading(true); setReloadKey(k => k + 1); }} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8 transition-colors duration-300 pb-32">
    {dialog}
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <PageHeader
          eyebrow="Evolução"
          title="Peso e medidas"
          subtitle="Acompanhe seu corpo ao longo do tempo."
          actions={
            <button
                type="button"
                onClick={() => setShowModal(true)}
                className="btn-primary-gradient pressable min-h-[44px] px-4 text-xs"
            >
                <Plus className="w-4 h-4" aria-hidden="true" /> Nova medida
            </button>
          }
        />

        {measurements.length === 0 ? (
            <EmptyState
                icon={Scale}
                title="Comece sua jornada"
                description="Registre seu peso hoje para acompanhar sua evolução."
                action={<button type="button" onClick={() => setShowModal(true)} className="btn-primary-gradient min-h-[44px] px-5 text-sm">Registrar agora</button>}
            />
        ) : (
            <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="surface p-4 sm:p-5 animate-fade-up">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Peso atual</p>
                        <h3 className="font-display text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.current}kg</h3>
                    </div>
                    <div className="surface p-4 sm:p-5 animate-fade-up" style={{ animationDelay: '70ms' }}>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Variação total</p>
                        <h3 className={`font-display text-3xl font-black mt-1 ${Number(stats.diff) <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {stats.diffSign}{stats.diff}kg
                        </h3>
                    </div>
                    <div className="surface p-4 sm:p-5 animate-fade-up" style={{ animationDelay: '140ms' }}>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">IMC estimado</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="font-display text-3xl font-black text-gray-900 dark:text-white">{stats.imc || '--'}</h3>
                            <span className={`text-xs font-bold ${stats.imcColor}`}>{stats.imcLabel}</span>
                        </div>
                    </div>
                    <button type="button" className="surface surface-hover pressable p-4 sm:p-5 flex flex-col justify-center items-center min-h-[88px] animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" style={{ animationDelay: '210ms' }} onClick={() => setShowModal(true)}>
                        <Plus className="w-6 h-6 mb-1 text-brand" aria-hidden="true" />
                        <span className="text-xs font-bold text-amber-700 dark:text-brand">Adicionar</span>
                    </button>
                </div>

                {/* Gráfico */}
                <WeightChart data={measurements} />

                {/* Galeria de Fotos (Timeline) */}
                {galleryPhotos.length > 0 && (
                    <div>
                        <h3 className="font-display text-lg font-black text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <Camera className="w-5 h-5 text-brand" aria-hidden="true" /> Galeria do shape
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-snap-x scroll-px-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                            {galleryPhotos.map((item) => (
                                <div key={item.id} className="snap-center shrink-0 w-40 relative group">
                                    <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-md bg-gray-200">
                                        <img src={item.photo} alt={`Foto do shape em ${formatDate(item.date)}`} loading="lazy" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="mt-2 text-center">
                                        <p className="text-sm font-bold text-gray-800 dark:text-white">{item.weight}kg</p>
                                        <p className="text-[10px] text-gray-500 uppercase">{formatDate(item.date)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Histórico em Lista */}
                <div className="surface overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03]">
                        <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300">Histórico Completo</h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-white/10">
                        {[...measurements].reverse().map((item, i) => (
                            <div key={item.id} className="p-3 sm:p-4 flex justify-between items-center group animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-white">{item.weight}kg</p>
                                    <p className="text-xs text-gray-400 capitalize">
                                        {formatDate(item.date, {weekday: 'short', day: 'numeric', month: 'long'})}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Calcula diferença com o anterior (que na lista reverse é o próximo índice) */}
                                    {i < measurements.length - 1 && (
                                        <span className={`text-xs font-bold ${
                                            (item.weight - measurements[measurements.length - 1 - (i+1)].weight) <= 0 
                                            ? 'text-green-500' : 'text-red-500'
                                        }`}>
                                            {(item.weight - measurements[measurements.length - 1 - (i+1)].weight).toFixed(1)}kg
                                        </span>
                                    )}
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        aria-label="Apagar medida"
                                        className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                    >
                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )}

        {showModal && <AddMeasurementModal onClose={() => setShowModal(false)} onSave={handleSaveMeasurement} />}
      </div>
    </div>
  );
}