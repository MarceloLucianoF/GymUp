import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnamnesisForm } from './Anamnesis';
import AssessmentForm from './AssessmentForm';
import AssessmentTimeline from './AssessmentTimeline';
import CoachHealthPanel from './CoachHealthPanel';

jest.mock('../../firebase/config', () => ({ db: {} }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../services/healthRecords', () => ({
  ...jest.requireActual('../../services/healthRecords'),
  getConsent: jest.fn(), listAssessments: jest.fn().mockResolvedValue([]), listAnamneses: jest.fn().mockResolvedValue([]),
  saveAssessment: jest.fn(), deleteAssessment: jest.fn()
}));
const svc = require('../../services/healthRecords');

test('PAR-Q: "sim" mostra o aviso de liberação médica e envia 7 respostas', () => {
  const onSave = jest.fn();
  render(<AnamnesisForm onSave={onSave} />);
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getAllByLabelText('Sim')[1]);
  expect(screen.getByRole('alert').textContent).toMatch(/liberação médica/);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar anamnese' }));
  expect(onSave.mock.calls[0][0].parq).toEqual([false, true, false, false, false, false, false]);
});

test('avaliação: mostra o % de gordura do Pollock 3 enquanto preenche', () => {
  render(<AssessmentForm kinds={['instructor']} onSave={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Sexo (para o cálculo)'), { target: { value: 'male' } });
  fireEvent.change(screen.getByLabelText('Idade (anos)'), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('Protocolo'), { target: { value: 'pollock3' } });
  fireEvent.change(screen.getByLabelText('Peitoral'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Abdominal'), { target: { value: '20' } });
  fireEvent.change(screen.getAllByLabelText('Coxa')[1], { target: { value: '15' } });   // [0] é o perímetro
  expect(screen.getByText(/Gordura estimada: 13.6%/)).toBeTruthy();
});

test('linha do tempo compara duas avaliações lado a lado', () => {
  const items = [
    { id: 'b', kind: 'self', date: '2026-10-01', weight: 78 },
    { id: 'a', kind: 'instructor', date: '2026-09-01', weight: 80 }
  ];
  render(<AssessmentTimeline items={items} />);
  screen.getAllByRole('checkbox').forEach((c) => fireEvent.click(c));
  expect(screen.getByRole('table')).toBeTruthy();
  expect(screen.getByText('-2 kg')).toBeTruthy();
});

test('professor sem consentimento vê "o aluno ainda não autorizou" e não lista dados', async () => {
  svc.getConsent.mockResolvedValueOnce(null);
  render(<CoachHealthPanel studentId="stu1" coachId="coach1" student={{ displayName: 'Ana' }} />);
  await waitFor(() => expect(screen.getByText('O aluno ainda não autorizou')).toBeTruthy());
  expect(svc.listAssessments).not.toHaveBeenCalled();
});

test('consentimento para outro professor não libera', async () => {
  svc.getConsent.mockResolvedValueOnce({ coachId: 'coach2' });
  render(<CoachHealthPanel studentId="stu1" coachId="coach1" student={{}} />);
  await waitFor(() => expect(screen.getByText('O aluno ainda não autorizou')).toBeTruthy());
});

test('com consentimento mostra anamnese e avaliações', async () => {
  svc.getConsent.mockResolvedValueOnce({ coachId: 'coach1' });
  svc.listAssessments.mockResolvedValue([]);
  svc.listAnamneses.mockResolvedValue([]);
  render(<CoachHealthPanel studentId="stu1" coachId="coach1" student={{ displayName: 'Ana' }} />);
  await waitFor(() => expect(screen.getByText('Registrar avaliação')).toBeTruthy());
  expect(svc.listAssessments).toHaveBeenCalledWith('stu1');
});
