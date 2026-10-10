/* eslint-disable testing-library/no-node-access */
import React from 'react';
import { render } from '@testing-library/react';
import usePageMeta from './usePageMeta';

const Page = ({ title, description, opts }) => {
  usePageMeta(title, description, opts);
  return null;
};

describe('usePageMeta', () => {
  beforeEach(() => { document.title = 'Base'; });

  it('define title e description e restaura o título ao desmontar', () => {
    const { unmount } = render(<Page title="Privacidade" description="Texto de teste" />);
    expect(document.title).toBe('Privacidade · BohTreinar');
    expect(document.head.querySelector('meta[name="description"]').getAttribute('content')).toBe('Texto de teste');
    unmount();
    expect(document.title).toBe('Base');
  });

  it('adiciona e remove noindex', () => {
    const { unmount } = render(<Page title="Perfil" opts={{ noindex: true }} />);
    expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toContain('noindex');
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
