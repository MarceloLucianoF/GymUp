import { EQUIPMENT, EQUIPMENT_LABELS, sanitizeEquipment } from '../../utils/equipment';
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { ImageError, prepareImage } from '../../utils/imageAttach';
import { useConfirm } from '../../hooks/useConfirm';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import usePageMeta from '../../hooks/usePageMeta';
import { exportMyData, deletionMailto } from '../../utils/exportData';
import PageHeader from '../../components/ui/PageHeader';
import { Accessibility, AlertTriangle, Bell, SlidersHorizontal, ArrowLeft, Camera, CheckCircle, ChevronRight, Download, Dumbbell, Lock, LogOut, Save, ShieldCheck, Trash2, User, Users } from 'lucide-react';
import MyCoachCard from '../../components/coach/MyCoachCard';
import NotificationSettings from '../../components/pwa/NotificationSettings';
import DeleteAccountModal from '../../components/account/DeleteAccountModal';
import AccountSecurity from '../../components/account/AccountSecurity';
import AccessibilitySettings from '../../components/account/AccessibilitySettings';
import CoachPaymentStatus from '../../components/account/CoachPaymentStatus';
import CoachShareSettings from '../../components/account/CoachShareSettings';
import { btnDanger, btnGhost, btnPrimary } from '../../components/coach/styles';

const TABS = [
  ['dados', 'Perfil', User], ['treinador', 'Treinador', Users], ['conta', 'Conta', ShieldCheck], ['ajustes', 'Ajustes', SlidersHorizontal]
];
const TAB_IDS = TABS.map(([id]) => id);

// Grupo dentro da aba: título curto e conteúdo; os grupos ficam separados por uma linha.
function ProfileGroup({ id, icon: Icon, title, children }) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 py-6 first:pt-0 last:pb-0">
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-600 dark:text-gray-400">
        <Icon className="h-4 w-4 text-brand" aria-hidden="true" /> {title}
      </h2>
      {children}
    </section>
  );
}

export default function Profile() {
  const { confirm, dialog } = useConfirm();
  const { user, userProfile, logout } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCoachCode = searchParams.get('coach') || '';
  const askedTab = searchParams.get('aba');
  const [tab, setTab] = useState(() => (TAB_IDS.includes(askedTab) ? askedTab : initialCoachCode ? 'treinador' : 'dados'));
  const tabRefs = React.useRef({});
  const selectTab = (id, focus = false) => {
    setTab(id);
    const next = new URLSearchParams(searchParams); next.set('aba', id); setSearchParams(next, { replace: true });
    if (focus) tabRefs.current[id]?.focus();
  };
  const onTabKey = (e) => {
    const i = TAB_IDS.indexOf(tab);
    const j = e.key === 'ArrowRight' ? (i + 1) % TAB_IDS.length : e.key === 'ArrowLeft' ? (i - 1 + TAB_IDS.length) % TAB_IDS.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? TAB_IDS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    selectTab(TAB_IDS[j], true);
  };
  const navigate = useNavigate();
  usePageMeta('Meu perfil', 'Seus dados, sua conta e suas preferências.', { noindex: true });
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

  const field = 'w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-3 min-h-[48px] outline-none focus:ring-2 focus:ring-brand dark:text-white';
  const fieldLabel = 'text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2 block';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8 transition-colors duration-300 pb-32">
    {dialog}
      <div className="max-w-2xl mx-auto">

        <PageHeader eyebrow="Conta" title="Meu perfil" subtitle="Seus dados, sua conta e suas preferências."
          actions={
            <button type="button" onClick={() => navigate('/home')} className="pressable min-h-[44px] px-3 text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar
            </button>
          }
        />

        {/* Cabeçalho: foto, nome e e-mail */}
        <div className="surface overflow-hidden animate-fade-up">
            <div className="aurora-bg h-24 bg-gradient-to-r from-brand to-[#FF9800]" />
            <div className="-mt-12 flex flex-col items-center px-5 pb-5 text-center">
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
                        <Camera className="w-5 h-5 mb-0.5" aria-hidden="true" />
                        <span className="text-[10px] font-bold">Alterar</span>
                        <input type="file" accept="image/*" aria-label="Alterar foto de perfil" onChange={handleImageUpload} className="sr-only" />
                    </label>
                    <span className="pointer-events-none absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-black shadow-md ring-2 ring-white dark:ring-gray-900 group-hover:opacity-0" aria-hidden="true"><Camera className="w-4 h-4" /></span>
                </div>
                <p className="mt-3 font-display text-lg font-black text-gray-900 dark:text-white">{formData.displayName || 'Sem nome'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
            </div>
        </div>

        {/* Abas: cada assunto numa tela, sem misturar */}
        <div className="surface mt-4 overflow-hidden">
            <div role="tablist" aria-label="Seções do perfil" onKeyDown={onTabKey} className="grid grid-cols-4 border-b border-gray-200 dark:border-white/10">
                {TABS.map(([id, label, Icon]) => {
                    const active = tab === id;
                    return (
                        <button key={id} ref={(el) => { tabRefs.current[id] = el; }} type="button" role="tab" id={`tab-${id}`} aria-controls={`painel-${id}`}
                            aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => selectTab(id)}
                            className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${active ? 'bg-brand/10 text-gray-900 dark:text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5'}`}>
                            <Icon className={`h-5 w-5 ${active ? 'text-amber-700 dark:text-brand' : ''}`} aria-hidden="true" />
                            {label}
                            {id === 'dados' && isDirty && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-amber-500" aria-label="alterações não salvas" />}
                            {active && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>

            <div role="tabpanel" id={`painel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="p-5 focus-visible:outline-none">
            {tab === 'dados' && (
        <form onSubmit={handleSave} className="divide-y divide-gray-100 dark:divide-white/10">
            <ProfileGroup id="perfil-dados" icon={User} title="Dados pessoais">
                <div>
                    <label htmlFor="profile-name" className={fieldLabel}>Nome de exibição</label>
                    <input id="profile-name" type="text" name="displayName" value={formData.displayName} onChange={handleChange} placeholder="Seu nome" autoComplete="name" className={`${field} font-bold`} />
                </div>
                <div>
                    <label htmlFor="profile-phone" className={fieldLabel}>WhatsApp ou telefone</label>
                    <input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" name="phone" value={formData.phone} onChange={handleChange} maxLength={20} placeholder="(31) 99999-9999" className={field} />
                    <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">Opcional. Só o seu treinador vinculado consegue ver este número.</p>
                </div>
                <div>
                    <div className="mb-2 flex items-end justify-between gap-2">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Medidas</span>
                        {imcData && <span className={`text-xs font-bold ${imcData.color}`}>IMC {imcData.value} ({imcData.label})</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label htmlFor="profile-weight" className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Peso (kg)</label>
                            <input id="profile-weight" type="text" inputMode="decimal" name="weight" placeholder="00.0" value={formData.weight} onChange={handleDecimalChange} className={`${field} font-mono text-center`} />
                        </div>
                        <div>
                            <label htmlFor="profile-height" className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Altura (cm)</label>
                            <input id="profile-height" type="text" inputMode="decimal" name="height" placeholder="000" value={formData.height} onChange={handleDecimalChange} className={`${field} font-mono text-center`} />
                        </div>
                        <div>
                            <label htmlFor="profile-age" className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Idade</label>
                            <input id="profile-age" type="text" inputMode="numeric" name="age" placeholder="00" value={formData.age} onChange={handleIntegerChange} className={`${field} font-mono text-center`} />
                        </div>
                    </div>
                </div>
            </ProfileGroup>

            <ProfileGroup id="perfil-treino" icon={Dumbbell} title="Treino">
                <div>
                    <label htmlFor="goal" className={fieldLabel}>Meta principal</label>
                    <select id="goal" name="goal" value={formData.goal} onChange={handleChange} className={`${field} cursor-pointer font-bold`}>
                        <option value="Hipertrofia">Hipertrofia</option>
                        <option value="Emagrecimento">Emagrecimento</option>
                        <option value="Força">Força</option>
                        <option value="Resistência">Resistência</option>
                    </select>
                </div>
                {/* O que tem na minha academia: a IA e o gerador só montam fichas com isso */}
                <fieldset>
                    <legend className={fieldLabel}>Equipamentos da minha academia</legend>
                    <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Treinos gerados pela IA usam só o que estiver marcado. Sem nenhuma marcação, vale tudo.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {EQUIPMENT.map((key) => (
                            <label key={key} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-3 text-sm font-bold text-gray-800 dark:bg-white/5 dark:text-gray-100">
                                <input type="checkbox" checked={formData.gymEquipment.includes(key)} onChange={() => toggleEquipment(key)} className="h-5 w-5 accent-[#FFC107]" />
                                {EQUIPMENT_LABELS[key]}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-gray-50 dark:divide-white/10 dark:bg-white/5">
                    {[['/measurements', 'Peso, medidas e fotos'], ['/measurements/saude', 'Avaliações e anamnese'], ['/academia', 'Minha academia']].map(([to, label]) => (
                        <li key={to}>
                            <Link to={to} className="flex min-h-[48px] items-center justify-between px-4 text-sm font-bold text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                                <span>{label}</span><ChevronRight className="h-4 w-4 text-gray-500" aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
            </ProfileGroup>

            {/* Salvar: fica à vista enquanto houver alteração nos dados ou no treino */}
            <div className={`pt-6 ${isDirty ? 'sticky bottom-24 z-20' : ''}`}>
                {isDirty && (
                    <p className="mb-2 flex items-center justify-center gap-1 rounded-xl bg-yellow-100 py-1.5 text-xs font-bold text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" role="status">
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Você tem alterações não salvas
                    </p>
                )}
                <button type="submit" disabled={!isDirty}
                    className={`${btnPrimary} w-full min-h-[56px] text-base disabled:bg-none disabled:bg-gray-200 disabled:text-gray-600 disabled:opacity-100 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-gray-400`}>
                    {isDirty ? <><Save className="w-5 h-5 text-black" aria-hidden="true" /> Salvar alterações</> : <><CheckCircle className="w-5 h-5" aria-hidden="true" /> Dados salvos</>}
                </button>
            </div>
        </form>
            )}
            {tab === 'treinador' && (
            <div className="divide-y divide-gray-100 dark:divide-white/10">
        <ProfileGroup id="perfil-treinador" icon={Users} title="Meu treinador">
            <MyCoachCard user={user} profile={{ ...userProfile, ...formData, coachId: userProfile?.coachId }} initialOpen={!!initialCoachCode} initialCode={initialCoachCode} />
            <CoachPaymentStatus profile={userProfile} />
            <CoachShareSettings uid={user.uid} coachId={userProfile?.coachId} />
        </ProfileGroup>
            </div>
            )}
            {tab === 'conta' && (
            <div className="divide-y divide-gray-100 dark:divide-white/10">
        <ProfileGroup id="perfil-conta" icon={ShieldCheck} title="Conta e segurança">
            <AccountSecurity user={user} />
        </ProfileGroup>
        {/* SEUS DADOS (LGPD) */}
        <ProfileGroup id="perfil-privacidade" icon={Lock} title="Privacidade e dados">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Baixe uma cópia do seu perfil, treinos concluídos e medidas, ou exclua a conta. Veja a{' '}
            <Link to="/privacidade" className="font-bold underline">Política de Privacidade</Link>.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
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
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {userProfile?.role === 'user'
              ? 'A exclusão apaga seus treinos, medidas, conversas, perfil e login de forma definitiva. Baixe uma cópia antes, se quiser.'
              : 'Contas de treinador e administrador são removidas pelo suporte após o pedido por e-mail.'}
          </p>
        </ProfileGroup>
        <section className="py-6 last:pb-0"><button type="button" onClick={handleLogout} className={`${btnDanger} w-full min-h-[52px]`}>
            <LogOut className="w-4 h-4" aria-hidden="true" /> Sair da conta
        </button></section>
            </div>
            )}
            {tab === 'ajustes' && (
            <div className="divide-y divide-gray-100 dark:divide-white/10">
        <ProfileGroup id="perfil-notificacoes" icon={Bell} title="Notificações">
            <NotificationSettings uid={user.uid} className="" embedded />
        </ProfileGroup>
        <ProfileGroup id="perfil-aparencia" icon={Accessibility} title="Aparência e acessibilidade">
            <AccessibilitySettings />
        </ProfileGroup>
            </div>
            )}
            </div>
        </div>

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
        </div>

      </div>
    </div>
  );
}
