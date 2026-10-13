import { getPublicCoach, syncPublicCoachProfile } from './coachProfile';
import { doc, getDoc, setDoc } from 'firebase/firestore';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn() }));

// O CRA zera as implementações dos mocks a cada teste (resetMocks), então o doc() é refeito aqui.
beforeEach(() => { doc.mockImplementation((_, c, id) => `${c}/${id}`); });

test('getPublicCoach devolve null quando a leitura é negada (perfil ainda não existe)', async () => {
  getDoc.mockRejectedValue({ code: 'permission-denied' });
  await expect(getPublicCoach('c1')).resolves.toBeNull();
});

test('syncPublicCoachProfile cria o perfil mesmo quando ler o inexistente é negado', async () => {
  getDoc.mockRejectedValue({ code: 'permission-denied' });
  await syncPublicCoachProfile('c1', { role: 'admin', displayName: 'Marcelo Filho' });
  expect(setDoc).toHaveBeenCalledWith('publicCoachProfiles/c1', expect.objectContaining({ uid: 'c1', role: 'admin', displayName: 'Marcelo Filho' }));
});

test('syncPublicCoachProfile não regrava quando nada mudou', async () => {
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ displayName: 'A', photoURL: '', bio: '', role: 'coach' }) });
  await syncPublicCoachProfile('c1', { role: 'coach', displayName: 'A' });
  expect(setDoc).not.toHaveBeenCalled();
});

test('aluno comum não cria perfil público', async () => {
  await syncPublicCoachProfile('u1', { role: 'user', displayName: 'X' });
  expect(setDoc).not.toHaveBeenCalled();
});
