import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';
import { lastPushError, nativeFcmToken, nativeNotificationPermission, pushEnabled, retryNativeFcm, sendTestPush } from '../../services/pushService';
import { stopWorkoutTimer, updateWorkoutTimer } from '../../services/workoutTimerNative';
import { btnGhost } from '../coach/styles';
import { plural } from '../../utils/text';

const Row = ({ label, ok, value }) => (
  <li className="flex items-start justify-between gap-3 py-1.5 text-sm">
    <span className="text-gray-700 dark:text-gray-300">{label}</span>
    <span className={`text-right font-bold ${ok === undefined ? 'text-gray-900 dark:text-white' : ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{value}</span>
  </li>
);
const btn = `${btnGhost} px-3 text-center disabled:cursor-not-allowed disabled:opacity-50`;

// Diagnóstico dos avisos no app Android: mostra o que está ativo e testa a notificação do treino e o aviso pelo servidor.
export default function AppDiagnostics() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    let perm = '?';
    try { perm = await nativeNotificationPermission({ ask: false }); } catch (e) { perm = `erro: ${e.message}`; }
    setInfo({
      perm,
      timer: Capacitor.isPluginAvailable('WorkoutTimer'),
      push: Capacitor.isPluginAvailable('PushNotifications'),
      google: Capacitor.isPluginAvailable('FirebaseAuthentication'),
      on: pushEnabled(),
      fcm: !!nativeFcmToken(),
      err: lastPushError()
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const testTimer = async () => {
    setBusy('timer');
    await updateWorkoutTimer({ title: 'Teste · BohTreinar', body: 'Cronômetro de 15 s\nA notificação deve tocar e vibrar no fim', endsAt: Date.now() + 15000, alertTitle: 'Descanso acabou · teste' });
    toast('Puxe as notificações: o cronômetro deve estar correndo. Em 15 s, toca e vibra.', { duration: 6000 });
    setTimeout(() => { stopWorkoutTimer(); setBusy(''); }, 25000);
  };
  const testServer = async () => {
    setBusy('server');
    try {
      if (!nativeFcmToken()) { const m = await retryNativeFcm(); if (m) { toast.error(`Cadastro falhou: ${m}`); return; } }
      const r = await sendTestPush();
      toast(r.sent > 0 ? `Aviso enviado para ${plural(r.sent, 'aparelho', 'aparelhos')}. Deve chegar em segundos.` : `Nenhum aviso entregue (${plural(r.devices, 'aparelho cadastrado', 'aparelhos cadastrados')}).`, { duration: 6000 });
    } catch (e) { toast.error(`Falhou: ${e.message}`); }
    finally { setBusy(''); load(); }
  };

  if (!info) return null;
  return (
    <section aria-labelledby="diag-title" className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
      <h3 id="diag-title" className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Diagnóstico do app</h3>
      <ul className="mt-2 divide-y divide-gray-200/70 dark:divide-white/5">
        <Row label="Permissão de notificação" ok={info.perm === 'granted'} value={info.perm === 'granted' ? 'permitida' : info.perm} />
        <Row label="Notificação do treino (nativa)" ok={info.timer} value={info.timer ? 'disponível' : 'ausente'} />
        <Row label="Avisos do servidor (FCM)" ok={info.push && info.fcm} value={!info.push ? 'ausente' : info.fcm ? 'cadastrado' : info.on ? 'não cadastrado' : 'desligado'} />
        <Row label="Login Google nativo" ok={info.google} value={info.google ? 'disponível' : 'ausente'} />
      </ul>
      {info.err && <p className="mt-2 break-words text-xs text-rose-700 dark:text-rose-400">Último erro: {info.err}</p>}
      <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <button type="button" onClick={testTimer} disabled={!!busy || !info.timer} className={btn}>{busy === 'timer' ? 'Testando…' : 'Testar notificação do treino'}</button>
        <button type="button" onClick={testServer} disabled={!!busy || !info.push} className={btn}>{busy === 'server' ? 'Enviando…' : 'Testar aviso do servidor'}</button>
      </div>
      <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">Se algo der errado, mande uma print desta seção.</p>
    </section>
  );
}
