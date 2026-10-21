import { toHealthConnectSession } from './healthExport';

test('converte check-in em sessão de musculação', () => {
  const s = toHealthConnectSession({ clientId: 'c1', trainingName: 'Peito', duration: 3600, setsCompleted: 12, date: '2026-10-21T12:00:00.000Z' });
  expect(s.startTime).toBe('2026-10-21T11:00:00.000Z');
  expect(s.endTime).toBe('2026-10-21T12:00:00.000Z');
  expect(s.metadata.clientRecordId).toBe('c1');
  expect(s.notes).toContain('12 séries');
});

test('sem data ou duração devolve null', () => {
  expect(toHealthConnectSession(null)).toBeNull();
  expect(toHealthConnectSession({ duration: 0, date: '2026-10-21' })).toBeNull();
  expect(toHealthConnectSession({ duration: 60, date: 'x' })).toBeNull();
});
