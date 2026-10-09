import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../hooks/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ArrowLeft, BarChart2, Calendar, Trophy, TrendingDown } from 'lucide-react';
import { formatDate } from '../../utils/format';

// --- GRÁFICO PRO (Layout Espaçoso) ---
const ProgressChart = ({ data }) => {
  if (!data || data.length === 0) return (
    <div className="surface h-64 flex flex-col items-center justify-center border-dashed text-gray-500 dark:text-gray-400 text-sm">
        <TrendingDown className="w-8 h-8 text-gray-400 mb-2 opacity-60" />
        <p>Sem dados suficientes.</p>
    </div>
  );

  // 1. AUMENTAR A RESOLUÇÃO E MARGENS
  // Usamos um canvas de 300x150 para ter mais precisão no posicionamento
  const width = 300; 
  const height = 150;
  const paddingX = 30; // Margem lateral (evita cortar bolinha na borda)
  const paddingY = 35; // Margem vertical (Espaço para texto EM CIMA e EMBAIXO)

  // 2. Processamento
  const points = data.map(d => ({
      val: Number(d.weight),
      label: d.weight + 'kg',
      date: d.dateStr
  }));

  const values = points.map(p => p.val);
  let maxVal = Math.max(...values);
  let minVal = Math.min(...values);

  // Correção de Escala (Evita linha reta)
  if (maxVal === minVal) {
      maxVal += 10;
      minVal = Math.max(0, minVal - 10);
  } else {
      const spread = maxVal - minVal;
      maxVal += spread * 0.2; // 20% de respiro
      minVal = Math.max(0, minVal - spread * 0.2);
  }

  const range = maxVal - minVal;

  // 3. Funções de Coordenadas (Mapeia valor -> pixel)
  const getX = (index) => {
      if (points.length === 1) return width / 2;
      return paddingX + (index / (points.length - 1)) * (width - (paddingX * 2));
  };

  const getY = (val) => {
      const normalized = (val - minVal) / range;
      // Inverte Y e mapeia para a área segura (dentro do padding)
      return (height - paddingY) - (normalized * (height - (paddingY * 2)));
  };

  // 4. Caminhos SVG
  const linePath = points.map((p, i) => `${getX(i)},${getY(p.val)}`).join(' ');
  // Fecha a área embaixo da linha até o "chão" (height - paddingY)
  const areaPath = `${getX(0)},${height} ${linePath} ${getX(points.length - 1)},${height}`;

  return (
    <div className="surface w-full p-4 relative animate-fade-up">
      
      {/* Título */}
      <div className="flex justify-between items-center mb-2 px-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Evolução (kg)</span>
          <span className="text-xs font-bold text-amber-700 bg-brand/15 dark:text-brand px-2.5 py-1 rounded-full">
             Max: {Math.max(...values)}kg
          </span>
      </div>

      {/* Container SVG Responsivo */}
      <div className="w-full aspect-[2/1]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" role="img" aria-label={`Gráfico de evolução de carga, máximo ${Math.max(...values)} kg`}>
            
            {/* Gradiente */}
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFC107" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#FFC107" stopOpacity="0" />
                </linearGradient>
            </defs>
            
            {/* Linhas Guia (Grid) */}
            <line x1={paddingX} y1={paddingY} x2={width-paddingX} y2={paddingY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" className="opacity-10" />
            <line x1={paddingX} y1={height-paddingY} x2={width-paddingX} y2={height-paddingY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" className="opacity-10" />

            {/* Área Sombreada */}
            {points.length > 1 && (
                <polygon points={areaPath} fill="url(#chartGradient)" />
            )}

            {/* Linha Principal */}
            {points.length > 1 && (
                <polyline
                    fill="none"
                    stroke="#FFC107"
                    strokeWidth="3"
                    points={linePath}
                    pathLength="1" strokeDasharray="1" style={{ '--len': 1 }} className="animate-draw"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
            
            {/* Pontos e Textos */}
            {points.map((p, i) => {
                const cx = getX(i);
                const cy = getY(p.val);
                
                // Lógica para não cortar texto nas pontas
                let textAnchor = "middle";
                if (i === 0) textAnchor = "start";
                if (i === points.length - 1) textAnchor = "end";

                // Só mostra data no primeiro, último e talvez no meio se tiver muitos pontos
                const showDate = i === 0 || i === points.length - 1 || (points.length > 4 && i === Math.floor(points.length/2));

                return (
                    <g key={i}>
                        {/* Linha vertical pontilhada até o chão */}
                        <line 
                            x1={cx} y1={cy} 
                            x2={cx} y2={height - paddingY} 
                            stroke="#FFC107" 
                            strokeWidth="1" 
                            strokeDasharray="2" 
                            className="opacity-20"
                        />

                        {/* Círculo */}
                        <circle 
                            cx={cx} 
                            cy={cy} 
                            r="4" 
                            className="fill-white dark:fill-gray-900"
                            stroke="#FFC107" 
                            strokeWidth="2" 
                        />
                        
                        {/* Texto do Peso (ACIMA do ponto) */}
                        <text 
                            x={cx} 
                            y={cy - 12} 
                            textAnchor="middle" 
                            fill="currentColor" 
                            className="text-[10px] fill-gray-700 dark:fill-white font-bold"
                            style={{ fontSize: '10px' }}
                        >
                            {p.label}
                        </text>

                        {/* Texto da Data (EMBAIXO do gráfico, na área de padding) */}
                        {showDate && (
                            <text 
                                x={cx} 
                                y={height - 10} // Posição fixa no rodapé
                                textAnchor={textAnchor} 
                                fill="currentColor" 
                                className="text-[9px] fill-gray-500 dark:fill-gray-400 font-mono uppercase"
                                style={{ fontSize: '9px' }}
                            >
                                {p.date}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
      </div>
    </div>
  );
};

export default function ExerciseAnalytics() {
  const { exerciseName } = useParams();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ pr: 0, totalReps: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  const cleanName = decodeURIComponent(exerciseName || "");

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !cleanName) return;

      try {
        const q = query(
            collection(db, 'checkIns'), 
            where('userId', '==', user.uid),
            orderBy('date', 'asc')
        );
        const snapshot = await getDocs(q);

        const logs = [];
        let maxWeight = 0;
        let sumReps = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            if (data.exercises && Array.isArray(data.exercises)) {
                const exerciseData = data.exercises.find(ex => ex.name === cleanName);
                
                if (exerciseData && exerciseData.sets) {
                    const bestSet = exerciseData.sets.reduce((prev, current) => 
                        (Number(current.weight) > Number(prev.weight) ? current : prev), { weight: 0 });

                    const totalRepsToday = exerciseData.sets.reduce((acc, curr) => acc + (Number(curr.reps) || 0), 0);

                    if (Number(bestSet.weight) > 0) {
                        logs.push({
                            date: data.date,
                            dateStr: formatDate(data.date, {day:'2-digit', month:'2-digit'}),
                            weight: Number(bestSet.weight),
                            reps: totalRepsToday
                        });
                        
                        if (Number(bestSet.weight) > maxWeight) maxWeight = Number(bestSet.weight);
                        sumReps += totalRepsToday;
                    }
                }
            }
        });

        setHistory(logs);
        setStats({ pr: maxWeight, totalReps: sumReps, count: logs.length });

      } catch (error) {
        console.error("Erro analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, cleanName]);

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8" role="status" aria-label="Carregando"><div className="max-w-3xl mx-auto space-y-4"><div className="skeleton-shimmer h-16 rounded-2xl"></div><div className="grid grid-cols-3 gap-3">{[0,1,2].map(i => <div key={i} className="skeleton-shimmer h-24 rounded-3xl"></div>)}</div><div className="skeleton-shimmer h-64 rounded-3xl"></div></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8 pb-32 transition-colors duration-300">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 animate-fade-up">
            <button 
                onClick={() => navigate(-1)} 
                aria-label="Voltar"
                className="pressable w-11 h-11 shrink-0 rounded-full surface !rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Evolução</p>
                <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white leading-tight break-words">
                    {cleanName}
                </h1>
            </div>
        </div>

        {history.length === 0 ? (
            <div className="text-center py-20 surface border-dashed">
                <BarChart2 className="w-12 h-12 text-gray-400 mx-auto mb-2 opacity-50" />
                <h3 className="text-lg font-bold text-gray-700 dark:text-white">Sem dados suficientes</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Continue treinando para gerar gráficos!
                </p>
            </div>
        ) : (
            <>
                {/* Cards de Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-brand to-[#FF9800] text-black p-4 rounded-3xl shadow-lg shadow-brand/20 animate-scale-in">
                        <p className="text-[10px] font-black opacity-80 uppercase">Recorde (PR)</p>
                        <h3 className="text-2xl font-black">{stats.pr}kg</h3>
                    </div>
                    <div className="surface p-4 animate-scale-in" style={{ animationDelay: '80ms' }}>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Reps totais</p>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white">{stats.totalReps}</h3>
                    </div>
                    <div className="surface p-4 animate-scale-in" style={{ animationDelay: '160ms' }}>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Treinos</p>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white">{stats.count}</h3>
                    </div>
                </div>

                {/* Gráfico */}
                <div>
                    <ProgressChart data={history} />
                </div>

                {/* Lista Histórico */}
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-white mb-4 mt-8 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-gray-500" /> Diário Detalhado
                    </h3>
                    <div className="space-y-3">
                        {[...history].reverse().map((log, i) => (
                            <div key={i} style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }} className="surface animate-fade-up p-4 flex justify-between items-center hover:border-brand/30 transition-colors">
                                <div>
                                    <p className="text-sm font-bold text-gray-800 dark:text-white capitalize">
                                        {formatDate(log.date, {weekday: 'long', day:'numeric', month:'long'})}
                                    </p>
                                    <p className="text-xs text-gray-400">{log.reps} repetições totais</p>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className="text-lg font-black text-amber-600 dark:text-brand">{log.weight}kg</span>
                                        {log.weight === stats.pr && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold shadow-sm flex items-center gap-1">PR <Trophy className="w-3 h-3 text-yellow-600 fill-yellow-600" /></span>}
                                    </div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Carga Máxima</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
}