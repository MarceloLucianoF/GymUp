import React, { useState } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useCoachDashboard } from '../../hooks/useCoachDashboard';
import toast from 'react-hot-toast';
import { X, Megaphone, ClipboardList, BookOpen, Zap, Users, DollarSign, Target, AlertTriangle, AlertCircle, MessageSquare, User, Settings, Flame, Smile, ArrowRight } from 'lucide-react';

// --- COMPONENTE: MODAL DE CONVITE ---
const InviteModal = ({ isOpen, onClose, coachCode }) => {
    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(coachCode);
        toast.success("Código copiado!");
    };

    const handleCopyLink = () => {
        const link = `${window.location.origin}/register?coach=${coachCode}`;
        navigator.clipboard.writeText(link);
        toast.success("Link copiado!");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative border border-gray-100 dark:border-gray-700">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-450 hover:text-gray-650 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center">
                    <X className="w-4 h-4" />
                </button>
                
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Megaphone className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-white">Convidar Alunos</h3>
                    <p className="text-sm text-gray-500 mt-1">Envie este código para seu aluno se vincular a você.</p>
                </div>

                <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Seu Código (UID)</p>
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <code className="text-xl font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider select-all break-all">
                                {coachCode}
                            </code>
                        </div>
                        <button 
                            onClick={handleCopy}
                            className="text-xs font-bold text-gray-500 hover:text-blue-500 flex items-center justify-center gap-1.5 w-full mt-2"
                        >
                            <ClipboardList className="w-3.5 h-3.5" /> Tocar para copiar
                        </button>
                    </div>

                    <button 
                        onClick={handleCopyLink}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Megaphone className="w-4 h-4 text-white" /> Copiar Link de Cadastro
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTES DE UI ---

const StatCard = ({ title, value, subtitle, icon: IconComponent, color, trend }) => (
  <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:border-blue-200 transition-colors">
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform ${color}`}>
        {IconComponent && <IconComponent className="w-12 h-12" />}
    </div>
    <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-black text-gray-800 dark:text-white mt-1">{value}</h3>
        {subtitle && <p className={`text-[10px] mt-1 font-bold ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>{subtitle}</p>}
    </div>
  </div>
);

const SectionHeader = ({ title, actionLabel, onAction }) => (
    <div className="flex justify-between items-center mb-4 px-1">
        <h3 className="font-bold text-gray-800 dark:text-white text-md flex items-center gap-2">{title}</h3>
        {actionLabel && (
            <button onClick={onAction} className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                {actionLabel} <ArrowRight className="w-3 h-3" />
            </button>
        )}
    </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function CoachHome() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const { stats, recentActivity, studentsAtRisk, loading } = useCoachDashboard(user);
  
  const [focusMode, setFocusMode] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Ação: Abrir Chat Interno
  const handleOpenChat = (student) => {
      navigate('/coach/chat', { 
          state: { 
              targetUser: { 
                  uid: student.uid, 
                  displayName: student.displayName || 'Aluno',
                  photoURL: student.photoURL 
              } 
          } 
      });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8 pb-32 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER & ACTIONS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                    Painel do Treinador 
                    {focusMode && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200 flex items-center gap-1">Modo Foco <Zap className="w-3 h-3 text-yellow-600 fill-yellow-600" /></span>}
                </h1>
                <p className="text-gray-500 text-xs mt-1">Gestão inteligente da sua carteira de alunos.</p>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                {/* BOTÃO CONVIDAR */}
                <button 
                    onClick={() => setShowInviteModal(true)}
                    className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-green-600/20 text-xs flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <Megaphone className="w-3.5 h-3.5" /> Convidar
                </button>

                {/* BOTÃO FICHAS (Meus Treinos) */}
                <button 
                    onClick={() => navigate('/admin/trainings')}
                    className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-600/20 text-xs flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <ClipboardList className="w-3.5 h-3.5" /> Fichas
                </button>

                {/* BOTÃO BIBLIOTECA (Exercícios) */}
                <button 
                    onClick={() => navigate('/admin/exercises')}
                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-indigo-600/20 text-xs flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <BookOpen className="w-3.5 h-3.5" /> Biblioteca
                </button>

                <button 
                    onClick={() => setFocusMode(!focusMode)}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-bold shadow-sm text-xs border transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                        focusMode 
                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                >
                    <Zap className={`w-3.5 h-3.5 ${focusMode ? 'fill-current' : ''}`} /> {focusMode ? 'Sair Foco' : 'Foco'}
                </button>
            </div>
        </div>

        {/* MODO FOCO: Se ativado, esconde métricas */}
        {!focusMode && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard 
                    title="Alunos Ativos" 
                    value={stats.active} 
                    subtitle="Carteira total" 
                    icon={Users} color="text-blue-500" 
                />
                <StatCard 
                    title="Receita (Est.)" 
                    value={`R$ ${stats.revenue}`} 
                    subtitle="Mensal recorrente" 
                    icon={DollarSign} color="text-green-500" trend="up"
                />
                <StatCard 
                    title="Retenção" 
                    value={`${stats.retention}%`} 
                    subtitle="Meta: > 90%" 
                    icon={Target} color="text-purple-500" 
                    trend={stats.retention > 90 ? 'up' : 'down'}
                />
                <StatCard 
                    title="Risco de Churn" 
                    value={stats.risk} 
                    subtitle="Alunos em perigo" 
                    icon={AlertTriangle} color="text-red-500" 
                    trend={stats.risk > 0 ? 'down' : 'up'}
                />
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUNA 1: OPERACIONAL */}
            <div className="space-y-6">
                
                {/* Card de Risco */}
                <div className={`rounded-3xl p-5 shadow-sm border transition-all ${studentsAtRisk.length > 0 ? 'bg-white dark:bg-gray-800 border-red-100 dark:border-red-900/30' : 'bg-white dark:bg-gray-800 border-gray-100'}`}>
                    <SectionHeader title={
                        <span className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" /> Risco de Churn 
                            <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{studentsAtRisk.length}</span>
                        </span>
                    } />
                    
                    <div className="space-y-3">
                        {studentsAtRisk.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 text-xs">
                                Tudo tranquilo! Nenhum aluno em risco.
                            </div>
                        ) : (
                            studentsAtRisk.map((student, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                                    <div>
                                        <p className="text-xs font-bold text-gray-800 dark:text-white">{student.displayName || 'Aluno'}</p>
                                        <p className="text-[10px] text-red-500 font-medium">
                                            {typeof student.daysInactive === 'number' ? `${student.daysInactive} dias off` : 'Novo aluno'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleOpenChat(student)}
                                            className="bg-white dark:bg-gray-700 p-2 rounded-lg text-green-600 shadow-sm hover:scale-105 transition-transform flex items-center justify-center"
                                            title="Enviar Mensagem"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                            onClick={() => navigate('/coach/students')}
                                            className="bg-white dark:bg-gray-700 p-2 rounded-lg text-blue-600 shadow-sm hover:scale-105 transition-transform flex items-center justify-center"
                                        >
                                            <User className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Ações Rápidas (LINKS ATIVADOS) */}
                <div className="bg-blue-600 rounded-3xl p-5 text-white shadow-lg shadow-blue-600/20">
                    <h3 className="font-bold text-sm mb-4 opacity-90">Atalhos Operacionais</h3>
                    <div className="grid grid-cols-2 gap-3 text-white">
                        <button onClick={() => setShowInviteModal(true)} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-left transition-colors flex flex-col">
                            <Megaphone className="w-5 h-5 text-white/95 mb-1.5" />
                            <span className="text-[10px] font-bold uppercase">Convidar</span>
                        </button>
                        <button onClick={() => navigate('/coach/students')} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-left transition-colors flex flex-col">
                            <Users className="w-5 h-5 text-white/95 mb-1.5" />
                            <span className="text-[10px] font-bold uppercase">Meus Alunos</span>
                        </button>
                        <button onClick={() => navigate('/coach/financial')} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-left transition-colors flex flex-col">
                            <DollarSign className="w-5 h-5 text-white/95 mb-1.5" />
                            <span className="text-[10px] font-bold uppercase">Financeiro</span>
                        </button>
                        <button onClick={() => navigate('/coach/settings')} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-left transition-colors flex flex-col">
                            <Settings className="w-5 h-5 text-white/95 mb-1.5" />
                            <span className="text-[10px] font-bold uppercase">Configurar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* COLUNA 2: FEED EM TEMPO REAL */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                    <SectionHeader title={
                        <span className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" /> Feed de Hoje
                        </span>
                    } actionLabel="Ver histórico" onAction={() => {}} />
                    
                    {recentActivity.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 flex flex-col items-center justify-center">
                            <Smile className="w-10 h-10 text-gray-400 mb-2 opacity-50" />
                            <p className="text-sm">Nenhum treino registrado hoje.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentActivity.map((checkIn, i) => (
                                <div 
                                    key={i} 
                                    onClick={() => navigate(`/history/${checkIn.id}`)}
                                    className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700 group cursor-pointer"
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600">
                                        {checkIn.userEmail?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-gray-800 dark:text-white text-xs truncate">
                                                {checkIn.userEmail}
                                            </h4>
                                            <span className="text-[10px] text-gray-400 font-mono">
                                                {new Date(checkIn.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Finalizou <span className="font-bold text-blue-600 dark:text-blue-400">{checkIn.trainingName}</span>
                                        </p>
                                    </div>
                                    <div className="text-right pl-2 border-l border-gray-100 dark:border-gray-700">
                                        <span className="block text-xs font-black text-gray-800 dark:text-white">{checkIn.totalVolume > 0 ? `${(checkIn.totalVolume/1000).toFixed(1)}t` : '-'}</span>
                                        <span className="text-[9px] text-gray-400 uppercase font-bold">Vol</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* MODAL DE CONVITE */}
        <InviteModal 
            isOpen={showInviteModal} 
            onClose={() => setShowInviteModal(false)} 
            coachCode={user.uid} 
        />

      </div>
    </div>
  );
}