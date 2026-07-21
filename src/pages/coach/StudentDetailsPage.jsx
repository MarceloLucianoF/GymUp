import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquare, Clock, Scale } from 'lucide-react';

// Componente simples de Gráfico de Barras (Volume)
const VolumeChart = ({ data }) => {
    if (!data || data.length === 0) return <div className="text-center text-gray-400 text-xs py-10">Sem dados suficientes</div>;
    
    const maxVol = Math.max(...data.map(d => d.totalVolume));
    
    return (
        <div className="flex items-end justify-between h-32 gap-2 mt-4">
            {data.slice(0, 14).reverse().map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none z-10">
                        {new Date(d.date).toLocaleDateString()} - {(d.totalVolume/1000).toFixed(1)}t
                    </div>
                    
                    <div 
                        className="w-full bg-blue-500 rounded-t-sm hover:bg-blue-400 transition-all"
                        style={{ height: `${(d.totalVolume / maxVol) * 100}%`, minHeight: '4px' }}
                    ></div>
                    <span className="text-[9px] text-gray-400">{new Date(d.date).getDate()}</span>
                </div>
            ))}
        </div>
    );
};

export default function StudentDetailsPage() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    
    const [student, setStudent] = useState(null);
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState({ totalWorkouts: 0, lastWorkout: null, avgVolume: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                // 1. Dados do Aluno
                const userDoc = await getDoc(doc(db, 'users', studentId));
                if (!userDoc.exists()) {
                    toast.error("Aluno não encontrado");
                    navigate('/coach/students');
                    return;
                }
                setStudent({ id: userDoc.id, ...userDoc.data() });

                // 2. Histórico de Treinos (Últimos 30)
                const qHistory = query(
                    collection(db, 'checkIns'), 
                    where('userId', '==', studentId),
                    orderBy('date', 'desc'),
                    limit(30)
                );
                const historySnap = await getDocs(qHistory);
                const historyList = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                setHistory(historyList);

                // 3. Cálculos Rápidos
                if (historyList.length > 0) {
                    const totalVol = historyList.reduce((acc, curr) => acc + (curr.totalVolume || 0), 0);
                    setStats({
                        totalWorkouts: historyList.length,
                        lastWorkout: historyList[0].date,
                        avgVolume: Math.round(totalVol / historyList.length)
                    });
                }

            } catch (error) {
                console.error(error);
                toast.error("Erro ao carregar detalhes.");
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [studentId, navigate]);

    if (loading) return <div className="h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8 pb-32 transition-colors duration-300">
            <div className="max-w-5xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => navigate('/coach/students')} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 transition-colors flex items-center justify-center">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4 flex-1">
                        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-md overflow-hidden">
                            {student.photoURL ? <img src={student.photoURL} className="w-full h-full object-cover" alt=""/> : student.displayName?.[0]}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-800 dark:text-white">{student.displayName}</h1>
                            <p className="text-sm text-gray-500">{student.email}</p>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        <button 
                            onClick={() => navigate('/coach/chat', { state: { targetUser: { uid: student.id, displayName: student.displayName, photoURL: student.photoURL } } })}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                        >
                            <MessageSquare className="w-4 h-4 text-white" /> Mensagem
                        </button>
                    </div>
                </div>

                {/* Cards de KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Treinos Realizados</p>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mt-1">{stats.totalWorkouts}</h3>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Volume Médio</p>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mt-1">{(stats.avgVolume / 1000).toFixed(1)}t</h3>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Peso Atual</p>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mt-1">{student.weight || '--'} <span className="text-sm text-gray-400">kg</span></h3>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Último Treino</p>
                        <h3 className="text-xl font-black text-gray-800 dark:text-white mt-1 truncate">
                            {stats.lastWorkout ? new Date(stats.lastWorkout).toLocaleDateString() : 'Nunca'}
                        </h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Gráfico de Evolução de Volume */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-4">Evolução de Carga (Volume Total)</h3>
                        <VolumeChart data={history} />
                    </div>

                    {/* Histórico Recente (Lista) */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-full max-h-[500px] overflow-y-auto">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-4">Histórico Recente</h3>
                        
                        {history.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-10">Nenhum treino registrado.</p>
                        ) : (
                            <div className="space-y-4">
                                {history.map(item => (
                                    <div key={item.id} className="flex items-start gap-3 pb-4 border-b border-gray-50 dark:border-gray-700 last:border-0 last:pb-0">
                                        <div className="mt-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-sm text-gray-800 dark:text-white">{item.trainingName}</h4>
                                                <span className="text-[10px] text-gray-400">{new Date(item.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex gap-3 mt-1 text-xs text-gray-500 font-mono items-center">
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-gray-400" /> {Math.floor(item.duration / 60)}min</span>
                                                <span className="flex items-center gap-1"><Scale className="w-3 h-3 text-gray-400" /> {(item.totalVolume / 1000).toFixed(1)}t</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}