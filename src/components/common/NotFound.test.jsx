/* eslint-disable testing-library/no-node-access */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../../pages/public/NotFound';
import ErrorBoundary from './ErrorBoundary';
import { isChunkLoadError, reloadOnceForChunkError } from '../../utils/chunkReload';

const Boom = () => { throw new Error('segredo-interno-stack'); };

describe('NotFound', () => {
  it('mostra 404 com link para o início e noindex', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /página não encontrada/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar ao início/i })).toHaveAttribute('href', '/');
    expect(document.head.querySelector('meta[name="robots"]')).not.toBeNull();
  });
});

describe('ErrorBoundary', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('mostra tela amigável sem vazar detalhes do erro e registra no console', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar ao início/i })).toBeInTheDocument();
    expect(screen.queryByText(/segredo-interno-stack/)).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('renderiza filhos quando não há erro e reseta com resetKey', () => {
    const { rerender } = render(<ErrorBoundary resetKey="a"><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<ErrorBoundary resetKey="b"><p>ok</p></ErrorBoundary>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});

describe('chunkReload', () => {
  const memory = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

  it('reconhece erros de chunk', () => {
    expect(isChunkLoadError({ name: 'ChunkLoadError' })).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('outro'))).toBe(false);
  });

  it('recarrega só uma vez dentro da janela', () => {
    const storage = memory();
    const reload = jest.fn();
    const err = new Error('Loading chunk 3 failed');
    expect(reloadOnceForChunkError(err, { storage, reload })).toBe(true);
    expect(reloadOnceForChunkError(err, { storage, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnceForChunkError(new Error('x'), { storage, reload })).toBe(false);
  });
});
