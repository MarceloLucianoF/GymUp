import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ModuleInDeployment from './ModuleInDeployment';

test('mostra aviso de módulo em implantação e leva para Minha academia', () => {
  render(<MemoryRouter><ModuleInDeployment /></MemoryRouter>);
  expect(screen.getByText('Módulo em implantação')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Minha academia' })).toHaveAttribute('href', '/academia');
});
