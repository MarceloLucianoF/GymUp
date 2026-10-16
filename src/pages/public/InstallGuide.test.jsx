import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InstallGuide from './InstallGuide';

test('guia de instalação traz os passos do iPhone e do Android', () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  render(<MemoryRouter><InstallGuide /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: /Instale o BohTreinar/ })).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Passos no iPhone e iPad' }).querySelectorAll('li')).toHaveLength(3);
  expect(screen.getByText('Adicionar à Tela de Início')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Passos no Android' }).querySelectorAll('li')).toHaveLength(2);
});
