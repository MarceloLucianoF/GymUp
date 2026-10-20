import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MyExercisesPage from './MyExercisesPage';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../hooks/AuthContext', () => ({ useAuthContext: () => ({ user: { uid: 'u1' } }) }));
jest.mock('../../services/myExercises', () => ({
  MY_EXERCISE_GROUPS: [['peito', 'Peito'], ['costas', 'Costas'], ['ombros', 'Ombros'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'], ['pernas', 'Pernas'], ['gluteos', 'Glúteos'], ['panturrilha', 'Panturrilha'], ['core', 'Core'], ['cardio', 'Cardio'], ['mobilidade', 'Alongamento e mobilidade']],
  listMyExercises: jest.fn(), saveMyExercise: jest.fn().mockResolvedValue('x'), updateMyExercise: jest.fn().mockResolvedValue(), deleteMyExercise: jest.fn().mockResolvedValue()
}));
jest.mock('../../utils/imageAttach', () => ({ ...jest.requireActual('../../utils/imageAttach'), prepareImage: jest.fn() }));

const svc = require('../../services/myExercises');
const img = require('../../utils/imageAttach');
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
const renderPage = () => render(<MemoryRouter><MyExercisesPage /></MemoryRouter>);

beforeEach(() => { jest.clearAllMocks(); window.confirm = jest.fn(() => true); });

test('sem exercícios mostra o convite; criar com foto grava só os campos esperados', async () => {
  svc.listMyExercises.mockResolvedValue([]);
  img.prepareImage.mockResolvedValue(JPEG);
  renderPage();
  expect(await screen.findByText('Você ainda não criou exercícios')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Novo exercício'));
  fireEvent.change(screen.getByPlaceholderText(/Remada no banco/), { target: { value: 'Remada do condomínio' } });
  fireEvent.change(screen.getByLabelText('Grupo muscular'), { target: { value: 'costas' } });
  fireEvent.change(screen.getByLabelText('Equipamento'), { target: { value: 'halter' } });
  fireEvent.change(screen.getByLabelText('Foto do exercício'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
  expect(await screen.findByAltText('Foto do exercício')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Salvar exercício'));
  await waitFor(() => expect(svc.saveMyExercise).toHaveBeenCalled());
  const [uid, f] = svc.saveMyExercise.mock.calls[0];
  expect(uid).toBe('u1');
  expect(f).toMatchObject({ name: 'Remada do condomínio', muscleGroup: 'costas', equipment: 'halter', kind: 'strength', photo: JPEG });
});

test('lista os exercícios com prescrição, edita e apaga (com confirmação)', async () => {
  svc.listMyExercises.mockResolvedValue([
    { id: 'mine_1', docId: '1', name: 'Remada do condomínio', muscleGroup: 'costas', equipment: 'halter', kind: 'strength', sets: '4', reps: '10', rest: 60, note: 'banco 3', photo: JPEG },
    { id: 'mine_2', docId: '2', name: 'Bike da sala', muscleGroup: 'cardio', equipment: 'cardio', kind: 'cardio', sets: '1', reps: '30', rest: 0, note: '' }
  ]);
  renderPage();
  expect(await screen.findByText('Remada do condomínio')).toBeInTheDocument();
  expect(screen.getByText(/4 x 10/)).toBeInTheDocument();
  expect(screen.getByText(/30 min/)).toBeInTheDocument();          // cardio em minutos
  expect(screen.getByAltText('Remada do condomínio')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Editar Remada do condomínio'));
  fireEvent.change(screen.getByDisplayValue('Remada do condomínio'), { target: { value: 'Remada no banco' } });
  fireEvent.click(screen.getByText('Salvar exercício'));
  await waitFor(() => expect(svc.updateMyExercise).toHaveBeenCalledWith('u1', '1', expect.objectContaining({ name: 'Remada no banco', photo: JPEG })));
  fireEvent.click(await screen.findByLabelText('Apagar Bike da sala'));
  await waitFor(() => expect(svc.deleteMyExercise).toHaveBeenCalledWith('u1', '2'));
  window.confirm = jest.fn(() => false);
  svc.deleteMyExercise.mockClear();
  fireEvent.click(screen.getByLabelText('Apagar Bike da sala'));
  expect(svc.deleteMyExercise).not.toHaveBeenCalled();
});
