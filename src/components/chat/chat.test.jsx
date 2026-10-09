import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatMessages from './ChatMessages';
import ChatComposer from './ChatComposer';
import { groupMessages } from './groupMessages';

const t = (min) => ({ seconds: 1700000000 + min * 60 });

describe('groupMessages', () => {
  it('agrupa mensagens seguidas do mesmo remetente', () => {
    const g = groupMessages([
      { id: 1, senderId: 'a', createdAt: t(0) },
      { id: 2, senderId: 'a', createdAt: t(1) },
      { id: 3, senderId: 'b', createdAt: t(2) },
    ]);
    expect(g.map((x) => x.messages.length)).toEqual([2, 1]);
  });
  it('separa grupos quando passa de 5 minutos', () => {
    const g = groupMessages([
      { id: 1, senderId: 'a', createdAt: t(0) },
      { id: 2, senderId: 'a', createdAt: t(10) },
    ]);
    expect(g).toHaveLength(2);
  });
});

describe('ChatMessages', () => {
  it('mostra estado vazio', () => {
    render(<ChatMessages messages={[]} userId="a" emptyTitle="Sem mensagens" />);
    expect(screen.getByText('Sem mensagens')).toBeInTheDocument();
  });
  it('mostra estado de carregamento', () => {
    render(<ChatMessages messages={[]} userId="a" loading />);
    expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
  });
  it('renderiza mensagens em região aria-live', () => {
    render(<ChatMessages userId="a" messages={[{ id: 1, senderId: 'b', text: 'Oi!', createdAt: t(0) }]} />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Oi!')).toBeInTheDocument();
  });
});

describe('ChatComposer', () => {
  it('desabilita envio vazio e envia texto limpando o campo', async () => {
    const onSend = jest.fn();
    render(<ChatComposer onSend={onSend} />);
    const button = screen.getByRole('button', { name: 'Enviar mensagem' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Mensagem'), 'olá{enter}');
    expect(onSend).toHaveBeenCalledWith('olá');
    expect(screen.getByLabelText('Mensagem')).toHaveValue('');
  });
});
