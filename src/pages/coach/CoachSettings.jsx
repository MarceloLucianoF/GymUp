import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Camera, Copy, Save } from 'lucide-react';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import ErrorState from '../../components/common/ErrorState';
import Avatar from '../../components/coach/Avatar';
import { btnPrimary, btnGhost, inputCls, labelCls, pageCls } from '../../components/coach/styles';

const EMPTY = { displayName: '', bio: '', phone: '', pixKey: '', defaultMonthlyFee: '120', photoURL: '' };

export default function CoachSettings() {
  const { user } = useAuthContext();
  const [formData, setFormData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setError(false);
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.exists() ? snap.data() : {};
      setFormData({
        displayName: data.displayName || user.displayName || '',
        bio: data.bio || '',
        phone: data.phone || '',
        pixKey: data.pixKey || '',
        defaultMonthlyFee: String(data.defaultMonthlyFee ?? '120'),
        photoURL: data.photoURL || user.photoURL || ''
      });
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const set = (field) => (e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // Imagem em base64 (MVP). Limite de 500kb para não inflar o documento.
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) return toast.error('Imagem muito grande (máx. 500kb)');
    const reader = new FileReader();
    reader.onloadend = () => setFormData((prev) => ({ ...prev, photoURL: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const fee = Number(String(formData.defaultMonthlyFee).replace(',', '.'));
    if (Number.isNaN(fee) || fee < 0) return toast.error('Informe um valor mensal válido.');
    if (!formData.displayName.trim()) return toast.error('Informe seu nome profissional.');
    setSaving(true);
    const toastId = toast.loading('Salvando perfil...');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        displayName: formData.displayName.trim(),
        defaultMonthlyFee: fee,
        updatedAt: new Date().toISOString()
      });
      toast.success('Perfil atualizado!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(user.uid);
      toast.success('Código copiado!');
    } catch (err) {
      toast.error('Não foi possível copiar.');
    }
  };

  if (loading) return <div className={pageCls}><div className="mx-auto max-w-2xl space-y-4" role="status" aria-label="Carregando"><div className="skeleton-shimmer h-10 w-2/3 rounded-2xl" /><div className="skeleton-shimmer h-96 rounded-3xl" /></div></div>;
  if (error) return <div className={pageCls}><ErrorState message="Não foi possível carregar seu perfil." onRetry={() => { setLoading(true); loadProfile(); }} /></div>;

  return (
    <div className={pageCls}>
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader eyebrow="Conta" title="Configurações" subtitle="Seu perfil profissional e dados de cobrança." />

        <form onSubmit={handleSave} className="space-y-5">
          <section className="surface animate-fade-up p-5 sm:p-6">
            <div className="mb-6 flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar name={formData.displayName} src={formData.photoURL} size="xl" className="!h-24 !w-24 !text-3xl" />
                <label className="pressable absolute -bottom-1 -right-1 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-brand text-black shadow-lg focus-within:ring-2 focus-within:ring-brand/50">
                  <Camera className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">Alterar foto de perfil</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                </label>
              </div>
              <p className="text-center text-xs text-gray-500">Esta foto aparece para seus alunos no chat.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="cs-name" className={labelCls}>Nome profissional</label>
                <input id="cs-name" value={formData.displayName} onChange={set('displayName')} className={inputCls} placeholder="Ex: Treinador João" autoComplete="name" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="cs-bio" className={labelCls}>Bio / especialidade</label>
                <textarea id="cs-bio" rows={4} value={formData.bio} onChange={set('bio')} className={`${inputCls} resize-none py-3`} placeholder="Ex: Especialista em hipertrofia e performance..." />
              </div>
              <div>
                <label htmlFor="cs-phone" className={labelCls}>Telefone</label>
                <input id="cs-phone" type="tel" inputMode="tel" value={formData.phone} onChange={set('phone')} className={inputCls} placeholder="(00) 00000-0000" autoComplete="tel" />
              </div>
              <div>
                <label htmlFor="cs-fee" className={labelCls}>Mensalidade padrão (R$)</label>
                <input id="cs-fee" type="number" min="0" step="0.01" inputMode="decimal" value={formData.defaultMonthlyFee} onChange={set('defaultMonthlyFee')} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="cs-pix" className={labelCls}>Chave PIX (para alunos)</label>
                <input id="cs-pix" value={formData.pixKey} onChange={set('pixKey')} className={inputCls} placeholder="CPF, e-mail ou chave aleatória" />
              </div>
            </div>
          </section>

          <section className="surface animate-fade-up p-5 sm:p-6" style={{ animationDelay: '80ms' }}>
            <h2 className="font-display text-base font-black text-gray-900 dark:text-white">Código de convite</h2>
            <p className="mb-3 mt-1 text-xs text-gray-500">Seus alunos informam este código no cadastro para se vincular a você.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-h-[48px] flex-1 select-all break-all rounded-2xl bg-gray-100 px-4 py-3 font-mono text-sm text-gray-800 dark:bg-white/5 dark:text-gray-100">{user.uid}</code>
              <button type="button" onClick={copyCode} className={btnGhost}><Copy className="h-4 w-4" /> Copiar</button>
            </div>
          </section>

          <button type="submit" disabled={saving} className={`${btnPrimary} w-full min-h-[52px]`}><Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar alterações'}</button>
        </form>
      </div>
    </div>
  );
}
