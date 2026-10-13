import { withLiveNames } from './useChat';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), where: jest.fn(), orderBy: jest.fn(), onSnapshot: jest.fn(), addDoc: jest.fn(),
  setDoc: jest.fn(), updateDoc: jest.fn(), doc: jest.fn(), serverTimestamp: jest.fn(), getDoc: jest.fn()
}));
jest.mock('react-hot-toast', () => ({ error: jest.fn() }));

const chat = { id: 'c', participants: ['coach', 'stu'], participantData: { stu: { name: 'Aluno Determinado', photo: null }, coach: { name: 'Treinador' } } };

test('mostra o nome atual do outro participante, não o gravado na criação do chat', () => {
  const out = withLiveNames(chat, 'coach', { stu: { name: 'Marcelo Luciano Filho', photo: 'p.jpg' } });
  expect(out.participantData.stu).toEqual({ name: 'Marcelo Luciano Filho', photo: 'p.jpg' });
  expect(out.participantData.coach.name).toBe('Treinador');
});

test('sem perfil atual disponível mantém o que está no chat', () => {
  expect(withLiveNames(chat, 'coach', {})).toBe(chat);
  expect(withLiveNames(null, 'coach', {})).toBe(null);
});
