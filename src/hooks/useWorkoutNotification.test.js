import { WORKOUT_NOTIF_TAG, workoutNotificationOptions } from './useWorkoutNotification';

test('descansando: mostra até que horas, botões Pular descanso e +30 s, sem som', () => {
  const end = new Date(2026, 9, 21, 22, 53).getTime();
  const { title, options } = workoutNotificationOptions({ title: 'Supino · Peito', setLabel: 'Série 2 de 3 · Meta 3 x 10 · 20 kg', progress: '4 de 12 séries concluídas', resting: true, restEndsAt: end, image: 'https://x/a.jpg' });
  expect(title).toBe('Supino · Peito');
  expect(options.body).toBe('Descansando até 22:53\nSérie 2 de 3 · Meta 3 x 10 · 20 kg\n4 de 12 séries concluídas');
  expect(options.tag).toBe(WORKOUT_NOTIF_TAG);
  expect(options.silent).toBe(true);
  expect(options.image).toBe('https://x/a.jpg');
  expect(options.actions.map((a) => a.action)).toEqual(['rest', 'add30']);
});

test('treinando: Concluir série e Desfazer série; fim do descanso toca e vibra', () => {
  const normal = workoutNotificationOptions({ title: 'x', setLabel: 'a', progress: 'b' }).options;
  expect(normal.body).toBe('a\nb');
  expect(normal.actions.map((a) => a.action)).toEqual(['done', 'undo']);
  const alert = workoutNotificationOptions({ title: 'x', setLabel: 'a', progress: 'b', alert: true }).options;
  expect(alert.body).toBe('Descanso acabou: bora!\na\nb');
  expect(alert.silent).toBe(false);
  expect(alert.renotify).toBe(true);
  expect(alert.vibrate).toEqual([250, 120, 250]);
});
