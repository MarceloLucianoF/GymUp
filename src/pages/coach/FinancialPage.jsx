import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import { SkeletonList } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

const computeStats = (data) => {
  const total = data.reduce((acc, s) => acc + (Number(s.monthlyFee) || 0), 0);
  const received = data
    .filter(s => s.paymentStatus === 'paid')
    .reduce((acc, s) => acc + (Number(s.monthlyFee) || 0), 0);
  return { total, received, pending: total - received };
};

export default function FinancialPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null); // { student, value }
  const [stats, setStats] = useState({ total: 0, received: 0, pending: 0 });

  const fetchFinancials = useCallback(async () => {
    setError(false);
    try {
      // Busca alunos do coach
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'user'),
        where('coachId', '==', user.uid)
      );
      const snap = await getDocs(q);
      
      const list = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          // Se não tiver dados financeiros, assume padrão
          monthlyFee: d.data().monthlyFee || 120, // R$ 120 padrão
          paymentStatus: d.data().paymentStatus || 'pending', // 'paid' | 'pending' | 'overdue'
          paymentDate: d.data().paymentDate || null
      }));

      setStudents(list);
      setStats(computeStats(list));
    } catch (error) {
      console.error(error);
      setError(true);
      toast.error("Erro ao carregar financeiro.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);


  // Atualizar Status de Pagamento
  const handleStatusChange = async (studentId, newStatus) => {
      try {
          // Atualiza no banco
          const updateData = { 
              paymentStatus: newStatus,
              lastPaymentUpdate: new Date().toISOString()
          };
          
          await updateDoc(doc(db, 'users', studentId), updateData);

          // Atualiza localmente
          const updatedList = students.map(s => 
              s.id === studentId ? { ...s, ...updateData } : s
          );
          setStudents(updatedList);
          setStats(computeStats(updatedList));
          
          if(newStatus === 'paid') toast.success("Pagamento confirmado! 💰");
      } catch (error) {
          toast.error("Erro ao atualizar.");
      }
  };

  // Editar valor da mensalidade (modal)
  const handleEditValue = (student) => setEditing({ student, value: String(student.monthlyFee ?? '') });

  const handleSaveValue = async (e) => {
      e.preventDefault();
      const { student, value } = editing;
      if (value === '' || isNaN(value) || Number(value) < 0) {
          toast.error("Informe um valor válido.");
          return;
      }
      try {
          await updateDoc(doc(db, 'users', student.id), { monthlyFee: Number(value) });
          setEditing(null);
          fetchFinancials(); // Recarrega tudo
          toast.success("Valor atualizado.");
      } catch (err) {
          toast.error("Erro ao salvar valor.");
      }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8"><SkeletonList count={4} itemClassName="h-24 w-full" /></div>;

  if (error) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8"><ErrorState message="Não foi possível carregar o financeiro." onRetry={() => { setLoading(true); fetchFinancials(); }} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8 pb-32">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <button onClick={() => navigate('/coach/dashboard')} className="text-gray-500 hover:text-blue-500 text-sm font-bold mb-2">← Voltar</button>
                <h1 className="text-3xl font-black text-gray-800 dark:text-white">Gestão Financeira 💵</h1>
            </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-400 uppercase">Receita Potencial</p>
                <h3 className="text-3xl font-black text-gray-800 dark:text-white">R$ {stats.total}</h3>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-800">
                <p className="text-xs font-bold text-green-600 uppercase">Recebido (Mês)</p>
                <h3 className="text-3xl font-black text-green-700 dark:text-green-400">R$ {stats.received}</h3>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-2xl border border-orange-100 dark:border-orange-800">
                <p className="text-xs font-bold text-orange-600 uppercase">Pendente</p>
                <h3 className="text-3xl font-black text-orange-700 dark:text-orange-400">R$ {stats.pending}</h3>
            </div>
        </div>

        {/* Tabela de Alunos */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg dark:text-white">Status de Pagamento</h3>
            </div>
            
            {students.length === 0 ? (
                <EmptyState title="Nenhum aluno vinculado" description="Quando um aluno usar seu código de convite, ele aparecerá aqui." />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="p-4">Aluno</th>
                                <th className="p-4">Valor</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {students.map(student => (
                                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-500 overflow-hidden">
                                                {student.photoURL ? <img src={student.photoURL} alt={student.displayName || 'Aluno'} className="w-full h-full object-cover"/> : student.displayName?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-white text-sm">{student.displayName}</p>
                                                <p className="text-xs text-gray-400">{student.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-gray-700 dark:text-gray-300">R$ {student.monthlyFee}</span>
                                            <button onClick={() => handleEditValue(student)} aria-label={`Editar mensalidade de ${student.displayName || "aluno"}`} className="text-gray-300 hover:text-blue-500">✎</button>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {student.paymentStatus === 'paid' ? (
                                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                                ✅ Pago
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">
                                                ⏳ Pendente
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {student.paymentStatus === 'pending' ? (
                                            <button 
                                                onClick={() => handleStatusChange(student.id, 'paid')}
                                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-transform active:scale-95"
                                            >
                                                Marcar Pago
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleStatusChange(student.id, 'pending')}
                                                className="text-gray-400 hover:text-orange-500 text-xs font-bold underline"
                                            >
                                                Desfazer
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} label="Editar mensalidade" className="w-full max-w-sm">
          <form onSubmit={handleSaveValue} className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-gray-800 dark:text-white">Mensalidade de {editing.student.displayName}</h3>
            <div>
              <label htmlFor="monthlyFee" className="text-xs font-bold text-gray-500 uppercase mb-1 block">Valor (R$)</label>
              <input
                id="monthlyFee"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-brand dark:text-white"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 py-3 rounded-xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-brand hover:bg-brand-dark text-black">Salvar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
