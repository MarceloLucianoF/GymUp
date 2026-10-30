import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CoachShareSettings from './CoachShareSettings';
import { getCoachShare, saveCoachShare } from '../../services/coachShare';

jest.mock('../../services/coachShare', () => ({
  ...jest.requireActual('../../services/coachShare'),
  getCoachShare: jest.fn(), saveCoachShare: jest.fn()
}));

const renderIt = (props) => render(<MemoryRouter><CoachShareSettings uid="u1" coachId="c1" {...props} /></MemoryRouter>);

test('sem treinador não mostra nada', () => {
  const { container } = renderIt({ coachId: null });
  expect(container).toBeEmptyDOMElement();
});

test('começa desligado e liga um item só para o treinador atual', async () => {
  getCoachShare.mockResolvedValue(null);
  saveCoachShare.mockResolvedValue({ coachId: 'c1', workouts: true, measurements: false });
  renderIt();
  const sw = await screen.findByRole('switch', { name: 'Meus treinos' });
  await waitFor(() => expect(sw).not.toBeDisabled());
  expect(sw).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(sw);
  await waitFor(() => expect(saveCoachShare).toHaveBeenCalledWith('u1', 'c1', { workouts: true, measurements: false }));
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Meus treinos' })).toHaveAttribute('aria-checked', 'true'));
});

test('autorização dada a outro treinador aparece desligada', async () => {
  getCoachShare.mockResolvedValue({ coachId: 'antigo', workouts: true, measurements: true });
  renderIt();
  const sw = await screen.findByRole('switch', { name: 'Peso, medidas e fotos' });
  await waitFor(() => expect(sw).not.toBeDisabled());
  expect(sw).toHaveAttribute('aria-checked', 'false');
});
