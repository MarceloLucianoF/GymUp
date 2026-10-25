// Notificação do treino no app Android (plugin nativo WorkoutTimer): cronômetro do descanso correndo, botões e alerta no fim.
// No site nada aqui é usado.
import { registerPlugin } from '@capacitor/core';

const WorkoutTimer = registerPlugin('WorkoutTimer');

export const updateWorkoutTimer = (data) => WorkoutTimer.update(data).catch(() => { /* sem permissão de notificação */ });
export const stopWorkoutTimer = () => WorkoutTimer.stop().catch(() => {});
/** Toques nos botões da notificação: done, undo, rest, add30 e restOver (o descanso acabou). Devolve a função para parar de ouvir. */
export function onWorkoutTimerAction(fn) {
  let handle = null;
  let stopped = false;
  WorkoutTimer.addListener('action', (e) => fn(e?.action)).then((h) => { if (stopped) h.remove(); else handle = h; });
  return () => { stopped = true; if (handle) handle.remove(); };
}
