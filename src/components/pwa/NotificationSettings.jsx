import React from 'react';
import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

const Toggle = ({ label, checked, onChange, disabled }) => (
  <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-brand" />
  </label>
);

// Seção "Notificações e app" do Perfil. Apenas notificações locais (sem push de servidor).
export default function NotificationSettings({ uid }) {
  const { prefs, updatePrefs, permission, requestPermission, notify, vibrate, playSound } = useNotifications(uid);

  const enable = async () => {
    const r = await requestPermission();
    if (r === 'granted') toast.success('Notificações ativadas');
  };

  const test = async () => {
    vibrate();
    playSound();
    const ok = await notify('BohTreinar', 'Notificação de teste funcionando!', { tag: 'test' });
    if (!ok) toast('Sem permissão de notificação: vibração e som foram testados.');
  };

  return (
    <section aria-labelledby="notif-title" className="mt-6 bg-white dark:bg-[#161b26] border border-gray-200 dark:border-white/10 rounded-3xl p-5">
      <h2 id="notif-title" className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">
        <Bell className="w-4 h-4 text-brand" aria-hidden="true" /> Notificações e app
      </h2>

      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        {permission === 'unsupported' && 'Este navegador não suporta notificações.'}
        {permission === 'default' && (
          <button type="button" onClick={enable} className="min-h-[44px] px-4 rounded-xl bg-brand text-black text-sm font-black">Permitir notificações</button>
        )}
        {permission === 'granted' && 'Permissão concedida.'}
        {permission === 'denied' && 'Permissão negada. Libere nas configurações do navegador/app (ícone de cadeado ou Configurações do site > Notificações) e recarregue.'}
      </div>

      <div className="mt-2 divide-y divide-gray-100 dark:divide-white/5">
        <Toggle label="Avisar quando o descanso acabar" checked={prefs.restDone} onChange={(v) => updatePrefs({ restDone: v })} />
        <Toggle label="Vibrar" checked={prefs.vibrate} onChange={(v) => updatePrefs({ vibrate: v })} />
        <Toggle label="Som curto" checked={prefs.sound} onChange={(v) => updatePrefs({ sound: v })} />
        <Toggle label="Lembrete de treino" checked={prefs.reminder} onChange={(v) => updatePrefs({ reminder: v })} />
      </div>

      {prefs.reminder && (
        <div className="mt-2">
          <label htmlFor="reminder-time" className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase block mb-1">Horário do lembrete</label>
          <input id="reminder-time" type="time" value={prefs.reminderTime} onChange={(e) => updatePrefs({ reminderTime: e.target.value })} className="min-h-[44px] bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 dark:text-white font-bold" />
          <p className="text-[11px] text-gray-500 mt-1">O aviso aparece ao abrir o app depois desse horário, se não houver treino hoje. Sem servidor, não é possível avisar com o app fechado.</p>
        </div>
      )}

      <button type="button" onClick={test} className="mt-4 w-full min-h-[48px] rounded-2xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-800 dark:text-white">Testar notificação</button>
    </section>
  );
}
