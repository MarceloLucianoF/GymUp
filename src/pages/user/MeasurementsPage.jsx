import React, { useState, useEffect, useMemo } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { collection, query, where, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Camera, Scale, TrendingDown, X, Plus, Calendar, ArrowLeft } from 'lucide-react';

// --- SUB-COMPONENTES ---

// 1. Gráfico de Peso (Custom SVG)
const WeightChart = ({ data }) => {
  if (!data || data.length < 2) return (
    <div className="h-48 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
        <TrendingDown className="w-8 h-8 text-gray-400 mb-2 opacity-60" />
        <p className="text-sm">Registre pelo menos 2 pesagens.</p>
    </div>
  );

  const height = 180;
  const width = 300;
  const paddingX = 20;
  const paddingY = 20;

  const weights = data.map(d => d.weight);
  let minW = Math.min(...weights);
  let maxW = Math.max(...weights);

  // Ajuste de escala para o gráfico não ficar "colado"
  if (minW === maxW) {
      minW -= 5;
      maxW += 5;
  } else {
      const spread = maxW - minW;
      minW -= spread * 0.1;
      maxW += spread * 0.1;
  }
  const range = maxW - minW;

  const getX = (i) => paddingX + (i / (data.length - 1)) * (width - (paddingX * 2));
  const getY = (val) => (height - paddingY) - ((val - minW) / range) * (height - (paddingY * 2));

  const linePoints = data.map((d, i) => `${getX(i)},${getY(d.weight)}`).join(' ');
  const areaPoints = `${getX(0)},${height} ${linePoints} ${getX(data.length - 1)},${height}`;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Histórico de Peso</h3>
      </div>
      <div className="w-full aspect-[2/1] relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </linearGradient>
            </defs>
            
            {/* Grid */}
            <line x1={paddingX} y1={paddingY} x2={width-paddingX} y2={paddingY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" className="opacity-10" />
            <line x1={paddingX} y1={height-paddingY} x2={width-paddingX} y2={height-paddingY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" className="opacity-10" />

            <polygon points={areaPoints} fill="url(#weightGradient)" />
            <polyline fill="none" stroke="#10B981" strokeWidth="3" points={linePoints} strokeLinecap="round" strokeLinejoin="round" />

            {data.map((d, i) => (
               <circle key={i} cx={getX(i)} cy={getY(d.weight)} r="3" fill="#fff" stroke="#10B981" strokeWidth="2" />
            ))}
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-2 font-mono uppercase">
         <span>{new Date(data[0].date).toLocaleDateString('pt-BR')}</span>
         <span>{new Date(data[data.length-1].date).toLocaleDateString('pt-BR')}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-450 hover:text-gray-600 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
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
        </div>
    );
};

// --- PÁGINA PRINCIPAL ---

export default function MeasurementsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userHeight, setUserHeight] = useState(null);

  // 1. Carrega histórico e Altura do Perfil
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
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
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

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
      if(window.confirm("Apagar este registro?")) {
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#FFC107]"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-300 pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
            <button onClick={() => navigate('/home')} className="text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button 
                onClick={() => setShowModal(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-xs flex items-center gap-1.5 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
                <Plus className="w-3.5 h-3.5" /> Nova Medida
            </button>
        </div>

        {measurements.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center justify-center">
                <Scale className="w-16 h-16 text-gray-400 mb-4 opacity-50" />
                <h2 className="text-2xl font-bold text-gray-700 dark:text-white">Comece sua jornada</h2>
                <p className="text-gray-500 mb-6">Registre seu peso hoje para acompanhar sua evolução.</p>
                <button onClick={() => setShowModal(true)} className="text-[#FFC107] hover:text-[#FFB300] font-bold underline transition-colors">Registrar agora</button>
            </div>
        ) : (
            <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase">Peso Atual</p>
                        <h3 className="text-3xl font-black text-gray-800 dark:text-white mt-1">{stats.current}kg</h3>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase">Variação Total</p>
                        <h3 className={`text-3xl font-black mt-1 ${Number(stats.diff) <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {stats.diffSign}{stats.diff}kg
                        </h3>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase">IMC Estimado</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-3xl font-black text-gray-800 dark:text-white">{stats.imc || '--'}</h3>
                            <span className={`text-xs font-bold ${stats.imcColor}`}>{stats.imcLabel}</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => setShowModal(true)}>
                        <span className="text-2xl mb-1">➕</span>
                        <span className="text-xs font-bold text-[#FFC107] group-hover:text-[#FFB300] transition-colors">Adicionar</span>
                    </div>
                </div>

                {/* Gráfico */}
                <WeightChart data={measurements} />

                {/* Galeria de Fotos (Timeline) */}
                {galleryPhotos.length > 0 && (
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                            <span>📸</span> Galeria do Shape
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                            {galleryPhotos.map((item) => (
                                <div key={item.id} className="snap-center shrink-0 w-40 relative group">
                                    <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-md bg-gray-200">
                                        <img src={item.photo} alt="Shape" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="mt-2 text-center">
                                        <p className="text-sm font-bold text-gray-800 dark:text-white">{item.weight}kg</p>
                                        <p className="text-[10px] text-gray-500 uppercase">{new Date(item.date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Histórico em Lista */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300">Histórico Completo</h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {[...measurements].reverse().map((item, i) => (
                            <div key={item.id} className="p-4 flex justify-between items-center group">
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-white">{item.weight}kg</p>
                                    <p className="text-xs text-gray-400 capitalize">
                                        {new Date(item.date).toLocaleDateString('pt-BR', {weekday: 'short', day: 'numeric', month: 'long'})}
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
                                        className="text-gray-300 hover:text-red-500 transition-colors p-2"
                                    >
                                        🗑
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