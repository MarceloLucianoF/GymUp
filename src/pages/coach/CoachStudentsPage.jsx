import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Megaphone, User, ClipboardList, AlertTriangle, MessageSquare, DollarSign, X } from 'lucide-react';

export default function CoachStudentsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [students, setStudents] = useState([]);
  const [trainings, setTrainings] = useState([]); // Para o modal de seleção
  const [loading, setLoading] = useState(true);
  
  // Controle do Modal de Atribuição
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // 1. Buscar Dados (Alunos e Treinos do Coach)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // A. Buscar Alunos
        const qStudents = query(collection(db, 'users'), where('coachId', '==', user.uid));
        const studentsSnap = await getDocs(qStudents);
        const studentsList = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // B. Buscar Fichas (Para preencher o modal de seleção)
        const qTrainings = query(
            collection(db, 'trainings'), 
            where('coachId', '==', user.uid),
            orderBy('name')
        );
        const trainingsSnap = await getDocs(qTrainings);
        const trainingsList = trainingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setStudents(studentsList);
        setTrainings(trainingsList);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // 2. Helper para mostrar o nome do treino atual
  const getTrainingName = (trainingId) => {
      if (!trainingId) return null;
      // Tenta achar pelo ID ou pelo campo firestoreId (compatibilidade)
      const t = trainings.find(tr => tr.id === trainingId || tr.firestoreId === trainingId);
      return t ? t.name : 'Treino Removido';
  };

  // 3. Ação: Atribuir Treino
  const handleAssignTraining = async (trainingId) => {
      if (!selectedStudent) return;
      
      const loadingToast = toast.loading("Enviando ficha...");
      try {
          // Atualiza o perfil do aluno com o ID do treino
          await updateDoc(doc(db, 'users', selectedStudent.id), {
              currentTrainingId: trainingId
          });

          // Atualiza lista localmente (UX rápida)
          setStudents(prev => prev.map(s => 
              s.id === selectedStudent.id ? { ...s, currentTrainingId: trainingId } : s
          ));

          toast.success("Ficha updated!", { id: loadingToast });
          setShowModal(false);
      } catch (error) {
          console.error(error);
          toast.error("Erro ao atribuir.", { id: loadingToast });
      }
  };

  // 4. Ação: Chat Rápido
  const handleChat = (student) => {
      navigate('/coach/chat', { 
          state: { 
              targetUser: { 
                  uid: student.id, 
                  displayName: student.displayName, 
                  photoURL: student.photoURL 
              } 
          } 
      });
  };

  if (loading) return <div className="h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8 pb-32 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in-down">
            <div>
                <button onClick={() => navigate('/coach/dashboard')} className="text-gray-500 hover:text-blue-550 text-sm font-bold mb-2 flex items-center gap-1.5 p-2 hover:bg-gray-150 rounded-xl transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-2">Meus Alunos</h1>
                <p className="text-gray-500 text-sm">Gerencie o acesso e as fichas de treino.</p>
            </div>
            
            {/* Botão de convite rápido */}
            <button 
                onClick={() => navigate('/coach/dashboard')} 
                className="bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl font-bold shadow-sm text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            >
                <Megaphone className="w-4 h-4 text-gray-500" /> Pegar Código de Convite
            </button>
        </div>

        {/* Lista de Alunos */}
        {students.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                <User className="w-12 h-12 text-gray-400 mb-2 opacity-50" />
                <p className="text-gray-500 font-bold">Nenhum aluno vinculado ainda.</p>
                <p className="text-sm text-gray-400 mt-1">Envie seu código de convite para começar.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4 animate-fade-in-up">
                {students.map(student => {
                    const currentTrainingName = getTrainingName(student.currentTrainingId);
                    
                    return (
                        <div key={student.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-blue-200 transition-colors">
                            
                            {/* Info do Aluno (Clicável para ir aos Detalhes) */}
                            <div 
                                className="flex items-center gap-4 w-full md:w-auto cursor-pointer"
                                onClick={() => navigate(`/coach/students/${student.id}`)} 
                                title="Ver Prontuário"
                            >
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-md overflow-hidden relative">
                                    {student.photoURL ? <img src={student.photoURL} className="w-full h-full object-cover" alt=""/> : student.displayName?.[0]}
                                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors"></div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white text-lg hover:text-blue-600 transition-colors">{student.displayName}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span>{student.email}</span>
                                        <span className="w-2 h-2 rounded-full bg-green-500" title="Ativo"></span>
                                    </div>
                                </div>
                            </div>

                            {/* Status do Treino (Card Central) */}
                            <div className="flex-1 w-full md:px-8">
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                                    <div className="min-w-0 pr-2">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Ficha Atual</p>
                                        {currentTrainingName ? (
                                            <p className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 text-sm truncate">
                                                <ClipboardList className="w-4 h-4" /> {currentTrainingName}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-red-400 italic flex items-center gap-1.5">
                                                <AlertTriangle className="w-4 h-4 text-red-400" /> Sem ficha ativa
                                            </p>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => { setSelectedStudent(student); setShowModal(true); }}
                                        className="text-xs font-bold text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                    >
                                        Trocar
                                    </button>
                                </div>
                            </div>

                            {/* Ações */}
                            <div className="flex gap-2 w-full md:w-auto">
                                <button 
                                    onClick={() => handleChat(student)}
                                    className="flex-1 md:flex-none px-5 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition-colors rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                                    title="Abrir Chat"
                                >
                                    <MessageSquare className="w-4 h-4 text-blue-600" /> Chat
                                </button>
                                <button 
                                    onClick={() => navigate(`/coach/financial`)} 
                                    className="flex-1 md:flex-none px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-500 hover:border-green-400 hover:text-green-500 transition-colors rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                                    title="Financeiro"
                                >
                                    <DollarSign className="w-4 h-4 text-gray-500 group-hover:text-green-500" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* MODAL DE ATRIBUIÇÃO DE TREINO */}
        {showModal && selectedStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl relative flex flex-col max-h-[85vh] border border-gray-100 dark:border-gray-700">
                    
                    {/* Header Modal */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-gray-800 dark:text-white">Definir Ficha</h3>
                            <p className="text-sm text-gray-500">Para: <span className="font-bold text-blue-600">{selectedStudent.displayName}</span></p>
                        </div>
                        <button onClick={() => setShowModal(false)} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full hover:bg-gray-250 dark:hover:bg-gray-650 transition-colors text-gray-500 flex items-center justify-center">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Lista de Fichas Disponíveis */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                        {trainings.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 flex flex-col items-center justify-center">
                                <ClipboardList className="w-12 h-12 text-gray-400 mb-2 opacity-50" />
                                <p>Você não criou nenhuma ficha ainda.</p>
                                <button 
                                    onClick={() => navigate('/admin/trainings')} 
                                    className="text-blue-600 font-bold mt-2 hover:underline"
                                >
                                    Ir para Criador de Fichas
                                </button>
                            </div>
                        ) : (
                            trainings.map(t => {
                                const isCurrent = selectedStudent.currentTrainingId === t.id || selectedStudent.currentTrainingId === t.firestoreId;
                                return (
                                    <button 
                                        key={t.id}
                                        onClick={() => handleAssignTraining(t.id)} 
                                        disabled={isCurrent}
                                        className={`w-full text-left p-4 rounded-xl border transition-all flex justify-between items-center group ${
                                            isCurrent
                                            ? 'bg-green-50 border-green-500 ring-1 ring-green-500 dark:bg-green-900/20 opacity-80 cursor-default' 
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:shadow-md'
                                        }`}
                                    >
                                        <div>
                                            <h4 className={`font-bold ${isCurrent ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                                                {t.name}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-300 uppercase font-bold">
                                                    {t.difficulty}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {t.exercises?.length || 0} exercícios
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {isCurrent ? (
                                            <span className="text-green-600 font-bold text-xs bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                                                ATUAL
                                            </span>
                                        ) : (
                                            <span className="text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                                Selecionar →
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}