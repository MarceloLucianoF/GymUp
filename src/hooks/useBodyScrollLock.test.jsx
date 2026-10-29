import React from 'react';
import { render } from '@testing-library/react';
import useBodyScrollLock, { bodyScrollLockCount } from './useBodyScrollLock';
import Modal from '../components/common/Modal';

function Locker({ active = true }) { useBodyScrollLock(active); return null; }

let scrollTo;
beforeEach(() => {
  scrollTo = jest.fn();
  window.scrollTo = scrollTo;
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  document.body.removeAttribute('style');
});

test('fixa o body na posição atual e volta para ela ao fechar (iOS Safari ignora overflow hidden)', () => {
  window.scrollY = 640;
  document.body.style.overflow = 'auto';
  const { unmount } = render(<Locker />);
  expect(document.body.style.position).toBe('fixed');
  expect(document.body.style.top).toBe('-640px');
  expect(document.body.style.width).toBe('100%');
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.position).toBe('');
  expect(document.body.style.top).toBe('');
  expect(document.body.style.overflow).toBe('auto');
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 640 }));
  expect(bodyScrollLockCount()).toBe(0);
});

test('modais empilhados: só destrava quando o último fecha', () => {
  window.scrollY = 300;
  const first = render(<Locker />);
  window.scrollY = 0; // com o body fixo a janela fica em 0; não pode sobrescrever a posição guardada
  const second = render(<Locker />);
  expect(bodyScrollLockCount()).toBe(2);
  second.unmount();
  expect(document.body.style.position).toBe('fixed');
  expect(scrollTo).not.toHaveBeenCalled();
  first.unmount();
  expect(document.body.style.position).toBe('');
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 300 }));
});

test('inativo não trava; ativar e desativar respeita o contador', () => {
  const { rerender, unmount } = render(<Locker active={false} />);
  expect(bodyScrollLockCount()).toBe(0);
  rerender(<Locker active />);
  expect(bodyScrollLockCount()).toBe(1);
  rerender(<Locker active={false} />);
  expect(bodyScrollLockCount()).toBe(0);
  expect(document.body.style.position).toBe('');
  unmount();
  expect(bodyScrollLockCount()).toBe(0);
});

test('o Modal base trava o fundo enquanto está aberto', () => {
  const { unmount } = render(<Modal label="Teste" onClose={() => {}}><p>oi</p></Modal>);
  expect(document.body.style.position).toBe('fixed');
  unmount();
  expect(document.body.style.position).toBe('');
});
