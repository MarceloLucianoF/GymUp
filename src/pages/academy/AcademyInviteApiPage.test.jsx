import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

function mockLazy(names) { return Object.fromEntries(names.map((n) => [n, (...a) => mockApi[n](...a)])); }
const mockApi = { previewInvite: jest.fn(), acceptInvite: jest.fn(), setConsent: jest.fn() };
let mockUser = { uid: 'u1' };
jest.mock('../../firebase/config', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('../../services/academyApi', () => ({ academyApi: mockLazy(['previewInvite', 'acceptInvite', 'setConsent']), academyApiMessage: (e) => (e?.code === 'invite_invalid' ? 'Este convite é inválido, expirou ou já foi usado.' : 'erro') }));
jest.mock('../../hooks/AuthContext', () => ({ useAuthContext: () => ({ user: mockUser, authLoading: false }) }));
jest.mock('react-hot-toast', () => { const t = jest.fn(); t.success = jest.fn(); t.error = jest.fn(); return { __esModule: true, default: t }; });
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));
import AcademyInviteApiPage from './AcademyInviteApiPage';

const CODE = 'a'.repeat(32);
const renderPage = () => render(<MemoryRouter initialEntries={[`/academia/convite/${CODE}`]}><Routes><Route path="/academia/convite/:id" element={<AcademyInviteApiPage />} /></Routes></MemoryRouter>);
beforeEach(() => { mockUser = { uid: 'u1' }; mockNavigate.mockReset(); });

test('prévia mostra academia e papel SEM aceitar; só o clique grava', async () => {
  mockApi.previewInvite.mockResolvedValue({ academyName: 'Academia Exemplo', role: 'student', expiresAt: '2026-10-21T00:00:00.000Z' });
  renderPage();
  expect(await screen.findByText('Academia Exemplo')).toBeInTheDocument();
  expect(screen.getByText(/Aluno/)).toBeInTheDocument();
  expect(mockApi.previewInvite).toHaveBeenCalledWith(CODE);
  expect(mockApi.acceptInvite).not.toHaveBeenCalled();
});

test('aceitar: chama a API com o código do link e volta para Minha academia', async () => {
  mockApi.previewInvite.mockResolvedValue({ academyName: 'Academia Exemplo', role: 'student', expiresAt: '2026-10-21T00:00:00.000Z' });
  mockApi.acceptInvite.mockResolvedValue({ academyId: 'x', academyName: 'Academia Exemplo', role: 'student' });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Entrar na academia' }));
  await waitFor(() => expect(mockApi.acceptInvite).toHaveBeenCalledWith(CODE));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/academia', { replace: true }));
  expect(mockApi.setConsent).not.toHaveBeenCalled();   // consentimento só se o aluno marcar
});

test('consentimento marcado no aceite é registrado depois da entrada', async () => {
  mockApi.previewInvite.mockResolvedValue({ academyName: 'Academia Exemplo', role: 'student', expiresAt: '2026-10-21T00:00:00.000Z' });
  mockApi.acceptInvite.mockResolvedValue({ academyId: 'x', academyName: 'Academia Exemplo', role: 'student' });
  mockApi.setConsent.mockResolvedValue({});
  renderPage();
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na academia' }));
  await waitFor(() => expect(mockApi.setConsent).toHaveBeenCalledWith('x', true));
});

test('convite inválido, expirado, revogado ou esgotado: a MESMA mensagem genérica', async () => {
  mockApi.previewInvite.mockRejectedValue({ code: 'invite_invalid' });
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Este convite é inválido, expirou ou já foi usado.');
  expect(screen.queryByRole('button', { name: 'Entrar na academia' })).toBeNull();
});

test('sem sessão: pede para entrar e nem consulta o convite', async () => {
  mockUser = null;
  renderPage();
  expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  expect(mockApi.previewInvite).not.toHaveBeenCalled();
});

test('falha ao aceitar mostra a mensagem e não navega', async () => {
  mockApi.previewInvite.mockResolvedValue({ academyName: 'Academia Exemplo', role: 'coach', expiresAt: '2026-10-21T00:00:00.000Z' });
  mockApi.acceptInvite.mockRejectedValue({ code: 'invite_invalid' });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Entrar na academia' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/inválido/);
  expect(mockNavigate).not.toHaveBeenCalled();
});
