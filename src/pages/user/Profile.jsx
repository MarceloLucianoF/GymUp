import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, User, Camera, MessageSquare, Save, CheckCircle, LogOut } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [originalData, setOriginalData] = useState({}); 
  const [coachData, setCoachData] = useState(null); // ✅ Dados do Coach
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

          // ✅ Busca dados do Coach se existir vínculo
          if (data.coachId) {
              const coachRef = doc(db, 'users', data.coachId);
              const coachSnap = await getDoc(coachRef);
              if (coachSnap.exists()) {
                  setCoachData({ uid: coachSnap.id, ...coachSnap.data() });
              }
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
    if (isDirty && !window.confirm("Você tem alterações não salvas. Sair mesmo assim?")) return;
    if (window.confirm("Deseja realmente sair?")) {
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

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#FFC107]"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-300 pb-24">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <button onClick={() => navigate('/home')} className="text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white font-bold flex items-center gap-1.5 p-2 hover:bg-gray-150 rounded-xl transition-colors">
                <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Meu Perfil</h1>
            <div className="w-8"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden relative">
            
            {/* Aviso Alteração */}
            {isDirty && (
                <div className="bg-yellow-105 dark:bg-yellow-900/30 text-yellow-750 dark:text-yellow-405 text-center text-xs font-bold py-2 absolute top-0 w-full z-10 animate-fade-in flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Você tem alterações não salvas
                </div>
            )}

            {/* Capa / Avatar */}
            <div className="h-32 bg-gradient-to-r from-[#FFC107] to-[#FFB300] relative">
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-800 p-1 shadow-xl relative group">
                        <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden font-bold text-gray-400">
                            {formData.photoURL ? (
                                <img src={formData.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg text-gray-500 dark:text-gray-400 flex items-center justify-center">
                                  {formData.displayName?.charAt(0).toUpperCase() || <User className="w-10 h-10" />}
                                </span>
                            )}
                        </div>
                        <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                            <Camera className="w-5 h-5 mb-0.5" />
                            <span className="text-[10px] font-bold">Alterar</span>
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                    </div>
                </div>
            </div>

            <div className="pt-16 pb-8 px-8">
                <form onSubmit={handleSave} className="space-y-6">
                    
                    {/* Dados Básicos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Nome de Exibição</label>
                            <input 
                                type="text" 
                                name="displayName"
                                value={formData.displayName} 
                                onChange={handleChange}
                                placeholder="Seu nome"
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#FFC107] dark:text-white font-bold"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Meta Principal</label>
                            <select 
                                name="goal"
                                value={formData.goal} 
                                onChange={handleChange}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#FFC107] dark:text-white cursor-pointer font-bold"
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
                        <div className="bg-[#FFC107]/10 border border-[#FFC107]/20 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-[#FFC107] dark:text-[#FFC107] uppercase mb-1">Seu Treinador</p>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#FFC107]/20 dark:bg-[#FFC107]/10 flex items-center justify-center text-[#FFC107] dark:text-[#FFB300] font-bold text-sm">
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
                                className="bg-white dark:bg-gray-800 text-[#FFC107] px-3 py-2 rounded-xl shadow-sm font-bold text-xs hover:bg-[#FFC107]/10 transition-colors border border-[#FFC107]/25 dark:border-gray-700 flex items-center gap-1"
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
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Peso (kg)</label>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    name="weight"
                                    placeholder="00.0"
                                    value={formData.weight} 
                                    onChange={handleDecimalChange}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#FFC107] dark:text-white font-mono text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Altura (cm)</label>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    name="height"
                                    placeholder="000"
                                    value={formData.height} 
                                    onChange={handleDecimalChange}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#FFC107] dark:text-white font-mono text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Idade</label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    name="age"
                                    placeholder="00"
                                    value={formData.age} 
                                    onChange={handleIntegerChange}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#FFC107] dark:text-white font-mono text-center"
                                />
                            </div>
                        </div>
                        
                        <div className="mt-4 text-right">
                            <button 
                                type="button"
                                onClick={() => navigate('/measurements')}
                                className="text-xs text-[#FFC107] font-bold hover:underline"
                            >
                                Ver histórico de evolução →
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-4">
                        <button 
                            type="submit" 
                            disabled={!isDirty}
                            className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                isDirty 
                                ? 'bg-gradient-to-r from-[#FFC107] to-[#FF9800] hover:from-[#FFC107] hover:to-[#FFB300] text-black shadow-lg shadow-[#FFC107]/20 hover:shadow-[0_0_20px_rgba(255,193,7,0.35)]' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed shadow-none'
                            }`}
                        >
                            {isDirty ? (
                                <><Save className="w-5 h-5 text-white" /> Salvar Alterações</>
                            ) : (
                                <><CheckCircle className="w-5 h-5 text-gray-400" /> Tudo atualizado</>
                            )}
                        </button>
                        
                        <button type="button" onClick={handleLogout} className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold py-4 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Sair da Conta
                        </button>
                    </div>

                </form>
            </div>
        </div>

        {/* Rodapé Informativo */}
        <div className="text-center mt-8 text-gray-400 text-xs">
            <p>AcademyUp v2.0</p>
            <p className="mt-1 font-mono opacity-50">UID: {user.uid.slice(0, 8)}...</p>
            <p className="mt-1">{user.email}</p>
        </div>

      </div>
    </div>
  );
}