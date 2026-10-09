import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useTheme } from '../../hooks/ThemeContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { ArrowLeft, AlertTriangle, User, Camera, MessageSquare, Save, CheckCircle, LogOut, Sun, Moon } from 'lucide-react';
import { getPublicCoach } from '../../services/coachProfile';

export default function Profile() {
  const { confirm, dialog } = useConfirm();
  const { user, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [originalData, setOriginalData] = useState({}); 
  const [coachData, setCoachData] = useState(null); // Dados do Coach
  const [formData, setFormData] = useState({
    displayName: '',
    goal: 'Hipertrofia',
    height: '',
    weight: '',
    age: '',
    photoURL: ''
  });

  const [isDirty, setIsDirty] = useState(false);

  // Carrega dados do Usuário E do Coach
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const initialData = {
            displayName: data.displayName || user.displayName || '',
            goal: data.goal || 'Hipertrofia',
            height: data.height || '',
            weight: data.weight || '',
            age: data.age || '',
            photoURL: data.photoURL || ''
          };
          setFormData(initialData);
          setOriginalData(initialData);

          // Busca dados do Coach se existir vínculo
          if (data.coachId) {
              const coach = await getPublicCoach(data.coachId);
              if (coach) setCoachData(coach);
          }
        }
      } catch (error) {
        console.error("Erro perfil:", error);
        toast.error("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  // Verifica mudanças
  useEffect(() => {
      const changed = JSON.stringify(formData) !== JSON.stringify(originalData);
      setIsDirty(changed);
  }, [formData, originalData]);

  // Handlers
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDecimalChange = (e) => {
    let value = e.target.value.replace(',', '.');
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setFormData({ ...formData, [e.target.name]: value });
    }
  };

  const handleIntegerChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
        toast.error("Imagem muito grande! Máximo 500KB.");
        return;
    }

    const loadingToast = toast.loading("Processando foto...");
    const reader = new FileReader();

    reader.onloadend = () => {
        const base64String = reader.result;
        setFormData(prev => ({ ...prev, photoURL: base64String }));
        toast.success("Foto pronta! Não esqueça de salvar.", { id: loadingToast });
    };

    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isDirty) return;

    const saveToast = toast.loading('Salvando perfil...');
    
    try {
      const cleanData = {
          ...formData,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          height: formData.height ? parseFloat(formData.height) : null,
          age: formData.age ? parseInt(formData.age) : null,
          updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'users', user.uid), cleanData);
      setOriginalData(formData);
      toast.success('Perfil atualizado com sucesso!', { id: saveToast });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar.', { id: saveToast });
    }
  };

  const handleLogout = async () => {
    if (isDirty && !(await confirm({ title: "Alterações não salvas", message: "Você tem alterações não salvas. Sair mesmo assim?", confirmLabel: "Sair", danger: true }))) return;
    if (await confirm({ title: "Sair", message: "Deseja realmente sair?", confirmLabel: "Sair" })) {
      await logout();
      navigate('/login');
    }
  };

  // IMC
  const calculateIMC = () => {
      const h = parseFloat(formData.height) / 100; 
      const w = parseFloat(formData.weight);
      if (h > 0 && w > 0) {
          const imc = w / (h * h);
          let label = "Normal";
          let color = "text-green-500";
          
          if (imc < 18.5) { label = "Abaixo do peso"; color = "text-yellow-500"; }
          else if (imc >= 25 && imc < 30) { label = "Sobrepeso"; color = "text-orange-500"; }
          else if (imc >= 30) { label = "Obesidade"; color = "text-red-500"; }

          return { value: imc.toFixed(1), label, color };
      }
      return null;
  };

  const imcData = calculateIMC();

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8" role="status" aria-label="Carregando"><div className="max-w-2xl mx-auto space-y-4"><div className="skeleton-shimmer h-12 rounded-2xl"></div><div className="skeleton-shimmer h-[28rem] rounded-3xl"></div></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8 transition-colors duration-300 pb-32">
    {dialog}
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <PageHeader eyebrow="Conta" title="Meu perfil" subtitle="Dados, medidas e preferências."
          actions={
            <button type="button" onClick={() => navigate('/home')} className="pressable min-h-[44px] px-3 text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar
            </button>
          }
        />

        <div className="surface overflow-hidden relative animate-fade-up">
            
            {/* Aviso Alteração */}
            {isDirty && (
                <div className="bg-yellow-105 dark:bg-yellow-900/30 text-yellow-750 dark:text-yellow-405 text-center text-xs font-bold py-2 absolute top-0 w-full z-10 animate-fade-in flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Você tem alterações não salvas
                </div>
            )}

            {/* Capa / Avatar */}
            <div className="aurora-bg h-32 bg-gradient-to-r from-brand to-[#FF9800] relative">
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-800 p-1 shadow-xl relative group">
                        <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden font-bold text-gray-400">
                            {formData.photoURL ? (
                                <img src={formData.photoURL} alt="Foto de perfil" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg text-gray-500 dark:text-gray-400 flex items-center justify-center">
                                  {formData.displayName?.charAt(0).toUpperCase() || <User className="w-10 h-10" />}
                                </span>
                            )}
                        </div>
                        <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 focus-within:opacity-100 cursor-pointer transition-opacity">
                            <Camera className="w-5 h-5 mb-0.5" />
                            <span className="text-[10px] font-bold">Alterar</span>
                            <input type="file" accept="image/*" aria-label="Alterar foto de perfil" onChange={handleImageUpload} className="sr-only" />
                        </label>
                        <span className="pointer-events-none absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-black shadow-md ring-2 ring-white dark:ring-gray-900 group-hover:opacity-0" aria-hidden="true"><Camera className="w-4 h-4" /></span>
                    </div>
                </div>
            </div>

            <div className="pt-16 pb-8 px-8">
                <form onSubmit={handleSave} className="space-y-6">
                    
                    {/* Dados Básicos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2 block">Nome de Exibição</label>
                            <input 
                                type="text" 
                                name="displayName"
                                value={formData.displayName} 
                                onChange={handleChange}
                                placeholder="Seu nome"
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-3 min-h-[48px] outline-none focus:ring-2 focus:ring-brand dark:text-white font-bold"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2 block">Meta Principal</label>
                            <select 
                                name="goal"
                                value={formData.goal} 
                                onChange={handleChange}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-3 min-h-[48px] outline-none focus:ring-2 focus:ring-brand dark:text-white cursor-pointer font-bold"
                            >
                                <option value="Hipertrofia">Hipertrofia</option>
                                <option value="Emagrecimento">Emagrecimento</option>
                                <option value="Força">Força Pura</option>
                                <option value="Resistência">Resistência</option>
                            </select>
                        </div>
                    </div>

                    {/* --- CARD DO TREINADOR --- */}
                    {coachData && (
                        <div className="bg-brand/10 border border-brand/20 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-brand dark:text-brand uppercase mb-1">Seu Treinador</p>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand/20 dark:bg-brand/10 flex items-center justify-center text-brand dark:text-brand-dark font-bold text-sm">
                                        {coachData.displayName?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-white text-sm">{coachData.displayName}</p>
                                        <p className="text-xs text-gray-500">Acompanhando sua evolução</p>
                                    </div>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => navigate('/chat')}
                                className="pressable min-h-[44px] bg-white dark:bg-white/10 text-amber-700 dark:text-brand px-4 rounded-2xl shadow-sm font-bold text-xs border border-brand/25 flex items-center gap-1.5"
                            >
                                <MessageSquare className="w-3.5 h-3.5" /> Chat
                            </button>
                        </div>
                    )}

                    <div className="border-t border-gray-100 dark:border-gray-700 my-6"></div>

                    {/* Medidas Físicas + IMC */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Medidas</h3>
                            {imcData && (
                                <div className="text-right">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold block">IMC Estimado</span>
                                    <span className={`text-sm font-bold ${imcData.color}`}>{imcData.value} ({imcData.label})</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2 block">Peso (kg)</label>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    name="weight"
                                    placeholder="00.0"
                                    value={formData.weight} 
                                    onChange={handleDecimalChange}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-3 min-h-[48px] outline-none focus:ring-2 focus:ring-brand dark:text-white font-mono text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2 block">Altura (cm)</label>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    name="height"
                                    placeholder="000"
                                    value={formData.height} 
                                    onChange={handleDecimalChange}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-3 min-h-[48px] outline-none focus:ring-2 focus:ring-brand dark:text-white font-mono text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2 block">Idade</label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    name="age"
                                    placeholder="00"
                                    value={formData.age} 
                                    onChange={handleIntegerChange}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-3 min-h-[48px] outline-none focus:ring-2 focus:ring-brand dark:text-white font-mono text-center"
                                />
                            </div>
                        </div>
                        
                        <div className="mt-4 text-right">
                            <button 
                                type="button"
                                onClick={() => navigate('/measurements')}
                                className="min-h-[44px] text-xs text-amber-700 dark:text-brand font-bold hover:underline"
                            >
                                Ver histórico de evolução →
                            </button>
                        </div>
                    </div>

                    {/* PREFERÊNCIAS DE APARÊNCIA */}
                    <div className="rounded-3xl bg-gray-50 dark:bg-white/5 p-5 transition-colors">
                        <h2 className="text-base font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                            {theme === 'dark' ? <Moon className="w-5 h-5 text-brand" /> : <Sun className="w-5 h-5 text-amber-500" />}
                            Aparência da Aplicação
                        </h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-white">
                                    {theme === 'dark' ? 'Modo Escuro (Nativo)' : 'Modo Claro'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {theme === 'dark' ? 'Identidade principal para uso no celular' : 'Visual claro alternativo'}
                                </p>
                            </div>
                            <button aria-label="Alternar tema"
                                type="button"
                                onClick={toggleTheme}
                                role="switch" aria-checked={theme === 'dark'}
                                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                                    theme === 'dark' ? 'bg-brand' : 'bg-gray-300'
                                }`}
                                title="Alternar entre modo escuro e claro"
                            >
                                <span
                                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-black dark:bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                        theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                                >
                                    {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-brand" /> : <Sun className="w-3.5 h-3.5 text-amber-600" />}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-4">
                        <button 
                            type="submit" 
                            disabled={!isDirty}
                            className={`w-full min-h-[56px] font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                isDirty 
                                ? 'bg-gradient-to-r from-brand to-[#FF9800] hover:from-brand hover:to-brand-dark text-black shadow-lg shadow-brand/20 hover:shadow-[0_0_20px_rgba(255,193,7,0.35)]' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed shadow-none'
                            }`}
                        >
                            {isDirty ? (
                                <><Save className="w-5 h-5 text-black" /> Salvar Alterações</>
                            ) : (
                                <><CheckCircle className="w-5 h-5 text-gray-400" /> Tudo atualizado</>
                            )}
                        </button>
                        
                        <button type="button" onClick={handleLogout} className="w-full min-h-[52px] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Sair da Conta
                        </button>
                    </div>

                </form>
            </div>
        </div>

        {/* Rodapé Informativo */}
        <div className="text-center mt-8 text-gray-500 dark:text-gray-400 text-xs">
            <p>AcademyUp v2.0</p>
            <p className="mt-1 font-mono opacity-50">UID: {user.uid.slice(0, 8)}...</p>
            <p className="mt-1">{user.email}</p>
        </div>

      </div>
    </div>
  );
}