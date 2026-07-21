import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../hooks/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ArrowLeft, BarChart2, Calendar, Trophy, TrendingDown } from 'lucide-react';

// --- GRÁFICO PRO (Layout Espaçoso) ---
const ProgressChart = ({ data }) => {
  if (!data || data.length === 0) return (
    <div className="h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-sm">
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
    <div className="w-full bg-white dark:bg-gray-800 rounded-3xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm relative">
      
      {/* Título */}
      <div className="flex justify-between items-center mb-2 px-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Evolução (kg)</span>
          <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">
             Max: {Math.max(...values)}kg
          </span>
      </div>

      {/* Container SVG Responsivo */}
      <div className="w-full aspect-[2/1]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            
            {/* Gradiente */}
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
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
                    stroke="#2563EB"
                    strokeWidth="3"
                    points={linePath}
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
                            stroke="#3b82f6" 
                            strokeWidth="1" 
                            strokeDasharray="2" 
                            className="opacity-20"
                        />

                        {/* Círculo */}
                        <circle 
                            cx={cx} 
                            cy={cy} 
                            r="4" 
                            fill="#fff" 
                            stroke="#2563EB" 
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
                                className="text-[9px] fill-gray-400 font-mono uppercase"
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
                            dateStr: new Date(data.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}),
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

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 pb-32 transition-colors duration-300">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
            <button 
                onClick={() => navigate(-1)} 
                className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Evolução</p>
                <h1 className="text-2xl font-black text-gray-800 dark:text-white leading-tight break-words">
                    {cleanName}
                </h1>
            </div>
        </div>

        {history.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
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
                    <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-600/20">
                        <p className="text-[10px] font-bold opacity-80 uppercase">Recorde (PR)</p>
                        <h3 className="text-2xl font-black">{stats.pr}kg</h3>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Volume Total</p>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white">{stats.totalReps}</h3>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Treinos</p>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white">{stats.count}</h3>
                    </div>
                </div>

                {/* Gráfico (Novo) */}
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
                            <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center hover:border-blue-200 transition-colors">
                                <div>
                                    <p className="text-sm font-bold text-gray-800 dark:text-white capitalize">
                                        {new Date(log.date).toLocaleDateString('pt-BR', {weekday: 'long', day:'numeric', month:'long'})}
                                    </p>
                                    <p className="text-xs text-gray-400">{log.reps} repetições totais</p>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className="text-lg font-black text-blue-600 dark:text-blue-400">{log.weight}kg</span>
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