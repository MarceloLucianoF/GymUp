import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';

describe('Modal', () => {
  it('expõe role=dialog modal com rótulo', () => {
    render(<Modal onClose={() => {}} label="Detalhes"><p>conteúdo</p></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Detalhes' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
  });

  it('fecha com Esc', async () => {
    const onClose = jest.fn();
    render(<Modal onClose={onClose} label="x">a</Modal>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('devolve o foco ao elemento anterior ao fechar', async () => {
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>abrir</button>
          {open && <Modal onClose={() => setOpen(false)} label="m">x</Modal>}
        </>
      );
    };
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'abrir' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('não renderiza quando fechado', () => {
    render(<ConfirmDialog open={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirma e cancela', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<ConfirmDialog open title="Excluir?" message="Sem volta" confirmLabel="Excluir" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Excluir?' })).toBeInTheDocument();
    expect(screen.getByText('Sem volta')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Esc cancela', async () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog open onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('mostra título, descrição e ação', () => {
    render(<EmptyState title="Nada aqui" description="Crie o primeiro" action={<button>Criar</button>} />);
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
    expect(screen.getByText('Crie o primeiro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('anuncia o erro com role=alert e permite tentar de novo', async () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Falhou" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sem onRetry não mostra botão', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
