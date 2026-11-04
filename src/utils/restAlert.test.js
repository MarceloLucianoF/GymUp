import { restAlertPlan } from './restAlert';

const count = (p, serverPushShown) => Number(p.workoutAlert) + Number(p.local) + Number(serverPushShown);

test('aba escondida com push do servidor: só o push avisa', () => {
  const p = restAlertPlan({ hidden: true, serverPush: true, workoutNotif: true });
  expect(p).toEqual({ workoutAlert: false, local: false });
  expect(count(p, true)).toBe(1);
});

test('aba escondida sem push: a notificação do treino avisa; sem ela, o aviso local', () => {
  expect(restAlertPlan({ hidden: true, serverPush: false, workoutNotif: true })).toEqual({ workoutAlert: true, local: false });
  expect(restAlertPlan({ hidden: true, serverPush: false, workoutNotif: false })).toEqual({ workoutAlert: false, local: true });
});

test('app na tela: o push é descartado pelo service worker; no máximo um aviso', () => {
  for (const workoutNotif of [true, false]) for (const serverPush of [true, false]) {
    const p = restAlertPlan({ hidden: false, serverPush, workoutNotif });
    expect(p.local).toBe(false);
    expect(count(p, false)).toBeLessThanOrEqual(1);
  }
});

test('em nenhuma combinação saem dois avisos', () => {
  for (const hidden of [true, false]) for (const serverPush of [true, false]) for (const workoutNotif of [true, false]) {
    const p = restAlertPlan({ hidden, serverPush, workoutNotif });
    expect(count(p, hidden && serverPush)).toBeLessThanOrEqual(1);
  }
});
