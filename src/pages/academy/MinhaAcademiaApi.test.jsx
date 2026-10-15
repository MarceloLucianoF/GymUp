import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

function mockLazy(names) { return Object.fromEntries(names.map((n) => [n, (...a) => mockApi[n](...a)])); }   // funções são içadas; mockApi só é lido na hora da chamada
const mockApi = { academies: jest.fn(), myAssignments: jest.fn(), acceptAssignment: jest.fn(), rejectAssignment: jest.fn(), revokeAssignment: jest.fn(), consent: jest.fn(), setConsent: jest.fn(), leave: jest.fn(), training: jest.fn() };
jest.mock('../../firebase/config', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('../../services/academyApi', () => ({ academyApi: mockLazy(['academies', 'myAssignments', 'acceptAssignment', 'rejectAssignment', 'revokeAssignment', 'consent', 'setConsent', 'leave', 'training']), GESTAO_URL: 'https://gestao.example', ACADEMY_API_ENABLED: true, academyApiMessage: (e) => `erro:${e?.code}` }));
jest.mock('../../hooks/AuthContext', () => ({ useAuthContext: () => ({ user: { uid: 'u1' }, userProfile: {} }) }));
jest.mock('react-hot-toast', () => { const t = jest.fn(); t.success = jest.fn(); t.error = jest.fn(); return { __esModule: true, default: t }; });
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));
import toast from 'react-hot-toast';
import MinhaAcademiaApi from './MinhaAcademiaApi';
import { loadSnapshot } from '../../services/academySnapshot';

const ACAD = 'acad000000000000000001';
const TRAIN = { assignmentId: 'asg_00000000000001', academyId: ACAD, trainingVersionId: 'tplaaaaaaaaaaaaaaaaaaaaa_1', version: 1, versionHash: 'f'.repeat(64), name: 'Perna A', description: '', exercises: [{ name: 'Agachamento', sets: '3', reps: '10', rest: 60 }] };
const student = { academyId: ACAD, name: 'Academia Exemplo', status: 'active', myRole: 'student', myStatus: 'active' };

function setup({ academies = [student], assignments = [], consent = { shareAdherence: false, status: 'none' }, training = { training: TRAIN } } = {}) {
  mockApi.academies.mockResolvedValue({ academies });
  mockApi.myAssignments.mockResolvedValue({ assignments });
  mockApi.consent.mockResolvedValue(consent);
  mockApi.training.mockResolvedValue(training);
  for (const k of ['acceptAssignment', 'rejectAssignment', 'revokeAssignment', 'setConsent', 'leave']) mockApi[k].mockResolvedValue({});
  return render(<MemoryRouter><MinhaAcademiaApi /></MemoryRouter>);
}
beforeEach(() => localStorage.clear());

test('sem academia: estado vazio explicativo, sem formulário de criar academia (isso é da Gestão)', async () => {
  setup({ academies: [] });
  expect(await screen.findByText(/ainda não está em uma academia/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/nome da academia/i)).toBeNull();
});

test('aluno vê a academia, a ficha atribuída (versão exata) e salva o snapshot local', async () => {
  setup();
  expect(await screen.findByText('Academia Exemplo')).toBeInTheDocument();
  expect(await screen.findByText(/Minha ficha: Perna A/)).toBeInTheDocument();
  expect(screen.getByText(/Versão 1\./)).toBeInTheDocument();
  await waitFor(() => expect(loadSnapshot('u1', ACAD)).toMatchObject({ trainingVersionId: 'tplaaaaaaaaaaaaaaaaaaaaa_1', versionHash: 'f'.repeat(64), assignmentId: 'asg_00000000000001' }));
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar treino' }));
  expect(mockNavigate).toHaveBeenCalledWith(`/execution/ac~${ACAD}~tplaaaaaaaaaaaaaaaaaaaaa_1`);
});

test('professor pendente: o aluno ACEITA e a lista é recarregada', async () => {
  setup({ assignments: [{ assignmentId: 'as1', academyId: ACAD, coachName: 'Beatriz Nunes', status: 'pending_student' }] });
  expect(await screen.findByText(/Beatriz Nunes/)).toBeInTheDocument();
  expect(screen.getByText(/Até você aceitar, ele não vê nada seu/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
  await waitFor(() => expect(mockApi.acceptAssignment).toHaveBeenCalledWith('as1'));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Professor aceito.'));
  expect(mockApi.academies).toHaveBeenCalledTimes(2);
});

test('professor pendente: o aluno RECUSA', async () => {
  setup({ assignments: [{ assignmentId: 'as1', academyId: ACAD, coachName: 'Beatriz Nunes', status: 'pending_student' }] });
  fireEvent.click(await screen.findByRole('button', { name: 'Recusar' }));
  await waitFor(() => expect(mockApi.rejectAssignment).toHaveBeenCalledWith('as1'));
  expect(mockApi.acceptAssignment).not.toHaveBeenCalled();
});

test('professor ativo: encerrar pede confirmação e só então chama a API', async () => {
  setup({ assignments: [{ assignmentId: 'as1', academyId: ACAD, coachName: 'Beatriz Nunes', status: 'active' }] });
  expect(await screen.findByText(/Seu professor é/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Encerrar vínculo' }));
  expect(mockApi.revokeAssignment).not.toHaveBeenCalled();
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Encerrar' }));
  await waitFor(() => expect(mockApi.revokeAssignment).toHaveBeenCalledWith('as1'));
});

test('consentimento: concede e REVOGA (separado do vínculo); o texto diz que a aderência individual ainda não é exibida', async () => {
  setup();
  expect(await screen.findByText(/Desativado: nada é compartilhado/)).toBeInTheDocument();
  expect(screen.getByText(/aderência individual ainda não é exibida/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ativar compartilhamento' }));
  await waitFor(() => expect(mockApi.setConsent).toHaveBeenCalledWith(ACAD, true));
});

test('revogar consentimento chama a API com false', async () => {
  setup({ consent: { shareAdherence: true, status: 'granted' } });
  expect(await screen.findByText(/Ativado: você autorizou/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Revogar compartilhamento' }));
  await waitFor(() => expect(mockApi.setConsent).toHaveBeenCalledWith(ACAD, false));
});

test('sair da academia: confirma, chama a API e APAGA o snapshot local', async () => {
  setup();
  await screen.findByText(/Minha ficha: Perna A/);
  await waitFor(() => expect(loadSnapshot('u1', ACAD)).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: /Sair da academia/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Sair' }));
  await waitFor(() => expect(mockApi.leave).toHaveBeenCalledWith(ACAD));
  expect(loadSnapshot('u1', ACAD)).toBeNull();
});

test('erro de rede ao carregar: estado de erro com nova tentativa', async () => {
  mockApi.academies.mockRejectedValueOnce({ code: 'network' });
  mockApi.myAssignments.mockResolvedValue({ assignments: [] });
  render(<MemoryRouter><MinhaAcademiaApi /></MemoryRouter>);
  const retry = await screen.findByRole('button', { name: /tentar/i });
  mockApi.academies.mockResolvedValue({ academies: [student] });
  mockApi.consent.mockResolvedValue({ shareAdherence: false }); mockApi.training.mockResolvedValue({ training: null });
  fireEvent.click(retry);
  expect(await screen.findByText('Academia Exemplo')).toBeInTheDocument();
});

test('quem não é aluno vê o atalho para a Gestão e nenhuma ficha', async () => {
  setup({ academies: [{ ...student, myRole: 'coach' }] });
  expect(await screen.findByText(/BohTreinar Gestão/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /abrir a Gestão/i })).toHaveAttribute('href', 'https://gestao.example');
  expect(mockApi.training).not.toHaveBeenCalled();
});

test('offline: sem internet a ficha vem do snapshot salvo e avisa', async () => {
  const { toSnapshot, saveSnapshot } = require('../../services/academySnapshot');
  saveSnapshot('u1', toSnapshot(TRAIN));
  mockApi.training.mockRejectedValue(Object.assign(new Error('network'), { code: 'network' }));
  setup({ training: undefined });
  mockApi.training.mockRejectedValue(Object.assign(new Error('network'), { code: 'network' }));
  expect(await screen.findByText(/Minha ficha: Perna A/)).toBeInTheDocument();
  expect(screen.getByText(/offline/i)).toBeInTheDocument();
});
