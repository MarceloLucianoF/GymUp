import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';

export default function CoachSettings() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    phone: '',
    pixKey: '',
    defaultMonthlyFee: '120',
    photoURL: ''
  });

  // Carregar dados atuais
  useEffect(() => {
    const loadProfile = async () => {
        if (!user) return;
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
                displayName: data.displayName || user.displayName || '',
                bio: data.bio || '',
                phone: data.phone || '',
                pixKey: data.pixKey || '',
                defaultMonthlyFee: data.defaultMonthlyFee || '120',
                photoURL: data.photoURL || user.photoURL || ''
            });
        }
    };
    loadProfile();
  }, [user]);

  // Handler de Imagem (Base64 para MVP)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) return toast.error("Imagem muito grande (Max 500kb)");

    const reader = new FileReader();
    reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoURL: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading("Salvando perfil...");

    try {
        // 1. Atualiza Firestore (Dados públicos para o aluno ver)
        await updateDoc(doc(db, 'users', user.uid), {
            ...formData,
            updatedAt: new Date().toISOString()
        });

        toast.success("Perfil atualizado!", { id: toastId });
    } catch (error) {
        console.error(error);
        toast.error("Erro ao salvar.", { id: toastId });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8 pb-32 transition-colors duration-300">
        <div className="max-w-2xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 animate-fade-in-down">
                <button onClick={() => navigate('/coach/dashboard')} className="text-gray-500 hover:text-blue-550 text-sm font-bold flex items-center gap-1.5 p-2 hover:bg-gray-150 rounded-xl transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-2xl font-black text-gray-800 dark:text-white">Configurações do Perfil</h1>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 animate-fade-in-up">
                
                <form onSubmit={handleSave} className="space-y-6">
                    
                    {/* Foto de Perfil */}
                    <div className="flex flex-col items-center gap-4 mb-6">
                        <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-4 border-white dark:border-gray-600 shadow-lg relative group flex items-center justify-center">
                            {formData.photoURL ? (
                                <img src={formData.photoURL} className="w-full h-full object-cover" alt="Perfil" />
                            ) : (
                                <User className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                            )}
                            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-bold">
                                Alterar
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                        <p className="text-xs text-gray-400">Essa foto aparecerá para seus alunos no chat.</p>
                    </div>

                    {/* Campos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nome Profissional</label>
                            <input 
                                value={formData.displayName}
                                onChange={e => setFormData({...formData, displayName: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 p-3 rounded-xl outline-none dark:text-white border border-transparent focus:border-blue-500"
                                placeholder="Ex: Treinador João"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Bio / Especialidade</label>
                            <textarea 
                                value={formData.bio}
                                onChange={e => setFormData({...formData, bio: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 p-3 rounded-xl outline-none dark:text-white border border-transparent focus:border-blue-500 h-24 resize-none"
                                placeholder="Ex: Especialista em Hipertrofia e Performance..."
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Valor Mensal Padrão (R$)</label>
                            <input 
                                type="number"
                                value={formData.defaultMonthlyFee}
                                onChange={e => setFormData({...formData, defaultMonthlyFee: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 p-3 rounded-xl outline-none dark:text-white border border-transparent focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Chave PIX (Para alunos)</label>
                            <input 
                                value={formData.pixKey}
                                onChange={e => setFormData({...formData, pixKey: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 p-3 rounded-xl outline-none dark:text-white border border-transparent focus:border-blue-500"
                                placeholder="CPF, Email ou Aleatória"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-70"
                    >
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>

                </form>
            </div>
        </div>
    </div>
  );
}