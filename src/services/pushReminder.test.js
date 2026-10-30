// Lembrete de volta ao treino (cliente): só chama o Worker com o push ativo e a preferência ligada; falha em silêncio.
import { scheduleInactivityReminder, cancelInactivityReminder, nudgeStudent } from './pushService';

const mockAuth = { currentUser: null };
jest.mock('../firebase/config', () => ({ get auth() { return mockAuth; } }));
jest.mock('./nativeApp', () => ({ isNativeApp: () => true }));   // pushSupported() verdadeiro sem PushManager no jsdom

const PREFS = 'academyup:notif-prefs:ana';
let calls;

beforeEach(() => {
  localStorage.clear();
  mockAuth.currentUser = { uid: 'ana', getIdToken: async () => 'tok' };
  calls = [];
  global.fetch = jest.fn(async (url, init) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : null, auth: init?.headers?.Authorization });
    return { ok: true, json: async () => ({ ok: true, scheduled: true }) };
  });
});

test('não chama a rota com o push desligado ou a preferência desligada', async () => {
  expect(await scheduleInactivityReminder({ lastWorkoutAt: '2026-10-29T10:00:00.000Z' })).toBe(false);
  localStorage.setItem('bt_push_on', '1');
  localStorage.setItem(PREFS, JSON.stringify({ inactivityReminder: false }));
  expect(await scheduleInactivityReminder({ lastWorkoutAt: '2026-10-29T10:00:00.000Z' })).toBe(false);
  expect(calls).toHaveLength(0);
});

test('preferência ligada por padrão: agenda com o nome do treinador e não repete o mesmo agendamento', async () => {
  localStorage.setItem('bt_push_on', '1');
  const loadCoachName = jest.fn(async () => 'Carla Souza');
  expect(await scheduleInactivityReminder({ lastWorkoutAt: '2026-10-29T10:00:00Z', loadCoachName })).toBe(true);
  expect(calls).toEqual([{ url: '/api/push/inactivity', body: { lastWorkoutAt: '2026-10-29T10:00:00.000Z', coachName: 'Carla Souza' }, auth: 'Bearer tok' }]);
  await scheduleInactivityReminder({ lastWorkoutAt: '2026-10-29T10:00:00Z', coachName: 'Carla Souza' });
  expect(calls).toHaveLength(1);   // nada mudou
  await scheduleInactivityReminder({ lastWorkoutAt: '2026-10-30T10:00:00Z' });
  expect(calls[1].body).toEqual({ lastWorkoutAt: '2026-10-30T10:00:00.000Z' });   // sem treinador, sem nome
});

test('sem data válida ou sem sessão: não chama; erro do servidor é silencioso', async () => {
  localStorage.setItem('bt_push_on', '1');
  expect(await scheduleInactivityReminder({ lastWorkoutAt: 'nunca' })).toBe(false);
  mockAuth.currentUser = null;
  expect(await scheduleInactivityReminder({ lastWorkoutAt: '2026-10-29T10:00:00Z' })).toBe(false);
  expect(calls).toHaveLength(0);
  mockAuth.currentUser = { uid: 'ana', getIdToken: async () => 'tok' };
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  await expect(scheduleInactivityReminder({ lastWorkoutAt: '2026-10-29T10:00:00Z' })).resolves.toBe(false);
});

test('cancelar envia { cancel: true } e libera o próximo agendamento', async () => {
  localStorage.setItem('bt_push_on', '1');
  await scheduleInactivityReminder({ lastWorkoutAt: '2026-10-29T10:00:00Z' });
  expect(await cancelInactivityReminder()).toBe(true);
  expect(calls[1].body).toEqual({ cancel: true });
  await scheduleInactivityReminder({ lastWorkoutAt: '2026-10-29T10:00:00Z' });
  expect(calls).toHaveLength(3);
});

test('nudge: traduz a resposta do servidor', async () => {
  const reply = (data, ok = true) => { global.fetch = jest.fn(async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok, status: ok ? 200 : 403, json: async () => data }; }); };
  reply({ sent: true });
  expect(await nudgeStudent('bia', 8.7)).toBe('sent');
  expect(calls.at(-1)).toEqual({ url: '/api/push/nudge', body: { studentId: 'bia', days: 8 } });
  reply({ sent: false, reason: 'no-subscription' });
  expect(await nudgeStudent('bia', 8)).toBe('no-subscription');
  reply({ sent: false, reason: 'rate-limited' });
  expect(await nudgeStudent('bia', 8)).toBe('rate-limited');
  reply({ error: 'x' }, false);
  expect(await nudgeStudent('bia', 8)).toBe('error');
});
