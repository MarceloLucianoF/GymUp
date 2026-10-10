import React from 'react';
import { render, screen } from '@testing-library/react';
import Markdown, { parseBlocks } from './Markdown';

describe('parseBlocks', () => {
  test('títulos, listas, regra e parágrafos', () => {
    const blocks = parseBlocks('### Metas\n* Proteínas: 164 g\n* Gorduras: 67 g\n---\n1. Primeiro\n2. Segundo\n\nTexto solto\ncontinua');
    expect(blocks.map((b) => b.type)).toEqual(['h', 'ul', 'hr', 'ol', 'p']);
    expect(blocks[1].items).toHaveLength(2);
    expect(blocks[4].text).toBe('Texto solto continua');
  });

  test('entrada vazia ou inválida não quebra', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks(null)).toEqual([]);
    expect(parseBlocks(undefined)).toEqual([]);
  });
});

describe('Markdown', () => {
  test('renderiza título, lista e negrito', () => {
    render(<Markdown text={'### 1. Metas\n* **Calorias:** 1.939 kcal\n* Água: 3 L'} />);
    expect(screen.getByRole('heading', { name: '1. Metas' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Calorias:').tagName).toBe('STRONG');
  });

  test('não mostra marcadores crus', () => {
    render(<Markdown text={'### Título\n* item\n---'} />);
    expect(screen.queryByText(/###/)).toBeNull();
    expect(screen.queryByText(/^\*/)).toBeNull();
  });

  test('HTML vira texto e nunca é interpretado', () => {
    render(<Markdown text={'<img src=x onerror="alert(1)"> **ok**'} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });

  test('itálico e código inline', () => {
    render(<Markdown text={'*Nota:* use `rtk gain`'} />);
    expect(screen.getByText('Nota:').tagName).toBe('EM');
    expect(screen.getByText('rtk gain').tagName).toBe('CODE');
  });
});

describe('Markdown: sublinhado não é formatação', () => {
  test('get_last_workout e __init__ ficam intactos', () => {
    render(<Markdown text={'Use get_last_workout e __init__ no código'} />);
    expect(screen.getByText('Use get_last_workout e __init__ no código')).toBeInTheDocument();
  });
});
