import { WORKOUT_NOTIF_TAG, workoutNotificationOptions } from './useWorkoutNotification';

test('notificação do treino: título, corpo, tag fixa e botões', () => {
  const { title, options } = workoutNotificationOptions({ title: 'Supino · Peito', setLabel: 'Série 2 de 3 · Meta 3 x 10', progress: '4 de 12 séries concluídas', resting: true });
  expect(title).toBe('Supino · Peito');
  expect(options.body).toBe('Descansando · Série 2 de 3 · Meta 3 x 10\n4 de 12 séries concluídas');
  expect(options.tag).toBe(WORKOUT_NOTIF_TAG);
  expect(options.silent).toBe(true);
  expect(options.actions.map((a) => a.action)).toEqual(['done', 'rest']);
});

test('sem descanso não aparece "Descansando"', () => {
  expect(workoutNotificationOptions({ title: 'x', setLabel: 'a', progress: 'b' }).options.body).toBe('a\nb');
});
