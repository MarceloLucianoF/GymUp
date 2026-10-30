import React from 'react';
import toast from 'react-hot-toast';
import { Bell, BellRing, Send } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { disablePush, enablePush, pushEnabled, pushSupported } from '../../services/pushService';
import { isNativeApp } from '../../services/nativeApp';
import AppDiagnostics from './AppDiagnostics';
import SwitchRow from '../ui/Switch';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../coach/styles';

// Seção "Notificações e app" do Perfil. Notificações locais e, opcionalmente, avisos com o app fechado (Web Push pelo Worker).
export default function NotificationSettings({ uid, className = 'mt-6', embedded = false }) {
  const { prefs, updatePrefs, permission, requestPermission, notify, vibrate, playSound } = useNotifications(uid);
  const [push, setPush] = React.useState(pushEnabled);
  const togglePush = async (on) => {
    if (!on) { await disablePush(); setPush(false); toast('Avisos com o app fechado desligados neste aparelho.'); return; }
    try {
      const ok = await enablePush();
      setPush(ok);
      if (ok) toast.success('Pronto: você recebe curtidas e o fim do descanso mesmo com o app fechado.');
      else toast.error('Sem permissão de notificação neste aparelho.');
    } catch (_) { setPush(false); toast.error('Não foi possível ligar os avisos agora.'); }
  };

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
    <section aria-labelledby="notif-title" className={embedded ? className : `surface p-5 ${className}`}>
      <h2 id="notif-title" className={embedded ? 'sr-only' : 'flex items-center gap-2 text-base font-bold text-gray-800 dark:text-white'}>
        <Bell className="h-5 w-5 text-brand" aria-hidden="true" /> Notificações e app
      </h2>

      <div className={`${embedded ? '' : 'mt-3 '}text-sm text-gray-600 dark:text-gray-400`}>
        {permission === 'unsupported' && <p>Este navegador não suporta notificações.</p>}
        {permission === 'default' && (
          <div className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
            <p>Permita as notificações para saber quando o descanso acabar.</p>
            <button type="button" onClick={enable} className={`${btnPrimary} w-full sm:w-auto`}>
              <BellRing className="h-4 w-4" aria-hidden="true" /> Permitir notificações
            </button>
          </div>
        )}
        {permission === 'granted' && <p className="font-bold text-emerald-700 dark:text-emerald-400">Permissão concedida.</p>}
        {permission === 'denied' && <p className="rounded-2xl bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">Permissão negada. Libere nas configurações do navegador/app (ícone de cadeado ou Configurações do site &gt; Notificações) e recarregue.</p>}
      </div>

      <div className="mt-2 divide-y divide-gray-100 dark:divide-white/5">
        <SwitchRow label="Avisar quando o descanso acabar" checked={prefs.restDone} onChange={(v) => updatePrefs({ restDone: v })} />
        {pushSupported() && <SwitchRow label="Avisos com o app fechado" hint="Curtidas e fim do descanso" checked={push} onChange={togglePush} />}
        <SwitchRow label="Vibrar" checked={prefs.vibrate} onChange={(v) => updatePrefs({ vibrate: v })} />
        <SwitchRow label="Som curto" checked={prefs.sound} onChange={(v) => updatePrefs({ sound: v })} />
        <SwitchRow label="Lembrete de treino" checked={prefs.reminder} onChange={(v) => updatePrefs({ reminder: v })} />
      </div>

      {prefs.reminder && (
        <div className="mt-2">
          <label htmlFor="reminder-time" className={labelCls}>Horário do lembrete</label>
          <input id="reminder-time" type="time" value={prefs.reminderTime} onChange={(e) => updatePrefs({ reminderTime: e.target.value })} className={`${inputCls} font-bold sm:w-48`} />
          <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">O aviso aparece ao abrir o app depois desse horário, se não houver treino hoje. Sem servidor, não é possível avisar com o app fechado.</p>
        </div>
      )}

      {isNativeApp() && <AppDiagnostics />}

      <button type="button" onClick={test} className={`${btnGhost} mt-4 w-full`}>
        <Send className="h-4 w-4" aria-hidden="true" /> Testar notificação
      </button>
    </section>
  );
}
