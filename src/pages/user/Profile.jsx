import { EQUIPMENT, EQUIPMENT_LABELS, sanitizeEquipment } from '../../utils/equipment';
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useTheme } from '../../hooks/ThemeContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { ImageError, prepareImage } from '../../utils/imageAttach';
import { useConfirm } from '../../hooks/useConfirm';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import usePageMeta from '../../hooks/usePageMeta';
import { exportMyData, deletionMailto } from '../../utils/exportData';
import PageHeader from '../../components/ui/PageHeader';
import { Download, Trash2, ArrowLeft, AlertTriangle, User, Camera, Save, CheckCircle, LogOut, Sun, Moon } from 'lucide-react';
import MyCoachCard from '../../components/coach/MyCoachCard';
import NotificationSettings from '../../components/pwa/NotificationSettings';
import DeleteAccountModal from '../../components/account/DeleteAccountModal';
import { SwitchControl } from '../../components/ui/Switch';
import { btnDanger, btnGhost, btnPrimary } from '../../components/coach/styles';

export default function Profile() {
  const { confirm, dialog } = useConfirm();
  const { user, userProfile, logout } = useAuthContext();
  const [searchParams] = useSearchParams();
  const initialCoachCode = searchParams.get('coach') || '';
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  usePageMeta('Meu perfil', 'Dados, medidas e preferências.', { noindex: true });
  const [exporting, setExporting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleExport = async () => {
    if (exporting || !user) return;
    setExporting(true);
    try {
      await exportMyData(user);
      toast.success('Arquivo gerado. Verifique seus downloads.');
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      toast.error('Não foi possível exportar agora. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };
  
  const [loading, setLoading] = useState(true);
  const [originalData, setOriginalData] = useState({}); 
  const [formData, setFormData] = useState({
    displayName: '',
    goal: 'Hipertrofia',
    height: '',
    weight: '',
    age: '',
    photoURL: '',
    phone: '',
    gymEquipment: []
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
            photoURL: data.photoURL || '',
            phone: data.phone || '',
            gymEquipment: sanitizeEquipment(data.gymEquipment)
          };
          setFormData(initialData);
          setOriginalData(initialData);

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

  const toggleEquipment = (key) => setFormData((f) => ({ ...f, gymEquipment: f.gymEquipment.includes(key) ? f.gymEquipment.filter((k) => k !== key) : [...f.gymEquipment, key] }));

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

  // Foto reduzida no aparelho (sem localização do GPS) em vez de recusar fotos grandes, como as do iPhone.
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const loadingToast = toast.loading("Processando foto...");
    try {
      const url = await prepareImage(file, 'avatar');
      setFormData(prev => ({ ...prev, photoURL: url }));
      toast.success("Foto pronta! Não esqueça de salvar.", { id: loadingToast });
    } catch (error) {
      toast.error(error instanceof ImageError ? error.message : 'Não consegui usar esta foto.', { id: loadingToast });
    }
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
          phone: String(formData.phone || '').replace(/[^0-9+() -]/g, '').slice(0, 20),
          gymEquipment: sanitizeEquipment(formData.gymEquipment),
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
          let color = "text-green-700 dark:text-green-400";
          
          if (imc < 18.5) { label = "Abaixo do peso"; color = "text-yellow-500"; }
          else if (imc >= 25 && imc < 30) { label = "Sobrepeso"; color = "text-orange-500"; }
          else if (imc >= 30) { label = "Obesidade"; color = "text-red-600 dark:text-red-400"; }

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
                        <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden font-bold text-gray-600 dark:text-gray-400">
                            {formData.photoURL ? (
                                <img src={formData.photoURL} alt="Foto de perfil" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg text-gray-600 dark:text-gray-400 flex items-center justify-center">
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
                            <label htmlFor="profile-phone" className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2 block">WhatsApp / Telefone</label>
                            <input
                                id="profile-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                maxLength={20}
                                placeholder="(31) 99999-9999"
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-3 min-h-[48px] outline-none focus:ring-2 focus:ring-brand dark:text-white"
                            />
                            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">Opcional. Só o seu treinador vinculado consegue ver este número.</p>
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label htmlFor="goal" className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2 block">Meta Principal</label>
                            <select 
                                id="goal"
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

                    {/* --- O que tem na minha academia: a IA e o gerador só montam fichas com isso --- */}
                    <fieldset className="mt-6 rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                        <legend className="px-1 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Equipamentos da minha academia</legend>
                        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Marque o que você tem. Treinos gerados pela IA usam só esses equipamentos. Sem nenhuma marcação, vale tudo.</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {EQUIPMENT.map((key) => (
                                <label key={key} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-white p-3 text-sm font-bold text-gray-800 dark:bg-white/5 dark:text-gray-100">
                                    <input type="checkbox" checked={formData.gymEquipment.includes(key)} onChange={() => toggleEquipment(key)} className="h-5 w-5 accent-[#FFC107]" />
                                    {EQUIPMENT_LABELS[key]}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* --- MEU TREINADOR: estados, pedido por busca/código e encerramento --- */}
                    <MyCoachCard user={user} profile={{ ...userProfile, ...formData, coachId: userProfile?.coachId }} initialOpen={!!initialCoachCode} initialCode={initialCoachCode} />

                    <div className="border-t border-gray-100 dark:border-gray-700 my-6"></div>

                    <Link to="/academia" className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-200">
                        <span>Minha academia</span><span aria-hidden="true">›</span>
                    </Link>

                    <div className="border-t border-gray-100 dark:border-gray-700 my-6"></div>

                    {/* Medidas Físicas + IMC */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Medidas</h2>
                            {imcData && (
                                <div className="text-right">
                                    <span className="text-[10px] text-gray-600 dark:text-gray-300 uppercase font-bold block">IMC Estimado</span>
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
                                className="min-h-[44px] text-xs text-amber-800 dark:text-amber-400 dark:text-brand font-bold hover:underline"
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
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    {theme === 'dark' ? 'Identidade principal para uso no celular' : 'Visual claro alternativo'}
                                </p>
                            </div>
                            <SwitchControl label="Alternar tema" checked={theme === 'dark'} onChange={toggleTheme}>
                                {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-amber-600" /> : <Sun className="w-3.5 h-3.5 text-amber-600" />}
                            </SwitchControl>
                        </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-4">
                        <button 
                            type="submit" 
                            disabled={!isDirty}
                            className={`${btnPrimary} w-full min-h-[56px] text-base disabled:bg-none disabled:bg-gray-200 disabled:text-gray-600 disabled:opacity-100 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-gray-400`}
                        >
                            {isDirty ? (
                                <><Save className="w-5 h-5 text-black" /> Salvar Alterações</>
                            ) : (
                                <><CheckCircle className="w-5 h-5" /> Tudo atualizado</>
                            )}
                        </button>
                        
                        <button type="button" onClick={handleLogout} className={`${btnDanger} w-full min-h-[52px]`}>
                            <LogOut className="w-4 h-4" /> Sair da Conta
                        </button>
                    </div>

                </form>
            </div>
        </div>

        <NotificationSettings uid={user.uid} />

        {/* SEUS DADOS (LGPD) */}
        <section aria-labelledby="seus-dados-title" className="surface mt-6 p-5">
          <h2 id="seus-dados-title" className="text-base font-bold text-gray-800 dark:text-white">Seus dados</h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Baixe uma cópia do seu perfil, treinos concluídos e medidas, ou peça a exclusão da conta. Veja a{' '}
            <Link to="/privacidade" className="font-bold underline">Política de Privacidade</Link>.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={handleExport} disabled={exporting} aria-busy={exporting}
              className={`${btnGhost} min-h-[48px] flex-1 disabled:opacity-60`}>
              <Download className="h-4 w-4" aria-hidden="true" /> {exporting ? 'Gerando...' : 'Exportar meus dados (JSON)'}
            </button>
            {userProfile?.role === 'user' ? (
              <button type="button" onClick={() => setShowDelete(true)}
                className={`${btnDanger} min-h-[48px] flex-1`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir minha conta
              </button>
            ) : (
              <a href={deletionMailto(user)}
                className={`${btnDanger} min-h-[48px] flex-1`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Solicitar exclusão
              </a>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            {userProfile?.role === 'user'
              ? 'A exclusão apaga seus treinos, medidas, conversas, perfil e login de forma definitiva. Baixe uma cópia antes, se quiser.'
              : 'Contas de treinador e administrador são removidas pelo suporte após o pedido por e-mail.'}
          </p>
        </section>

        {showDelete && (
          <DeleteAccountModal
            user={user}
            onClose={() => setShowDelete(false)}
            onExport={handleExport}
            onDeleted={() => { toast.success('Conta excluída. Sentiremos sua falta!'); navigate('/', { replace: true }); }}
          />
        )}

        {/* Rodapé Informativo */}
        <div className="text-center mt-8 text-gray-600 dark:text-gray-400 text-xs">
            <p>BohTreinar v2.0</p>
            <p className="mt-1 font-mono text-gray-600 dark:text-gray-400">UID: {user.uid.slice(0, 8)}...</p>
            <p className="mt-1">{user.email}</p>
        </div>

      </div>
    </div>
  );
}