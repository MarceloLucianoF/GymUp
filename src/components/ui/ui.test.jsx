import React from 'react';
import { render, screen, act } from '@testing-library/react';
import AnimatedNumber from './AnimatedNumber';
import ProgressRing from './ProgressRing';
import StatCard from './StatCard';

const mockReducedMotion = (matches) => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches, media: query, addEventListener: jest.fn(), removeEventListener: jest.fn(),
    addListener: jest.fn(), removeListener: jest.fn(), dispatchEvent: jest.fn(),
  }));
};

describe('AnimatedNumber', () => {
  afterEach(() => jest.useRealTimers());

  it('com prefers-reduced-motion mostra o valor final imediatamente', () => {
    mockReducedMotion(true);
    render(<AnimatedNumber value={1234} prefix="~" suffix=" kg" />);
    expect(screen.getByText(/~1\.234 kg/)).toBeInTheDocument();
  });

  it('respeita casas decimais', () => {
    mockReducedMotion(true);
    render(<AnimatedNumber value={2.5} decimals={1} />);
    expect(screen.getByText('2,5')).toBeInTheDocument();
  });

  it('sem reduced-motion começa em 0 e anima até o valor', () => {
    mockReducedMotion(false);
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    const callbacks = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { callbacks.push(cb); return callbacks.length; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const { container } = render(<AnimatedNumber value={100} duration={1000} />);
    expect(container).toHaveTextContent('0');
    now = 1000;
    act(() => { callbacks.shift()(now); });
    expect(container).toHaveTextContent('100');
    jest.restoreAllMocks();
  });
});

describe('ProgressRing', () => {
  beforeEach(() => mockReducedMotion(false));

  it('expõe o percentual no aria-label', () => {
    render(<ProgressRing value={42.4} />);
    expect(screen.getByRole('img', { name: '42%' })).toBeInTheDocument();
  });

  it('limita o valor entre 0 e 100', () => {
    const { rerender } = render(<ProgressRing value={250} />);
    expect(screen.getByRole('img', { name: '100%' })).toBeInTheDocument();
    rerender(<ProgressRing value={-5} />);
    expect(screen.getByRole('img', { name: '0%' })).toBeInTheDocument();
  });

  it('renderiza children no centro', () => {
    render(<ProgressRing value={10}><span>10</span></ProgressRing>);
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  beforeEach(() => mockReducedMotion(true));

  it('mostra rótulo e valor numérico animado', () => {
    render(<StatCard label="Treinos" value={12} />);
    expect(screen.getByText('Treinos')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('valor textual é exibido como está e tendência negativa usa seta para baixo', () => {
    render(<StatCard label="Volume" value="3.2t" trend={-8} />);
    expect(screen.getByText('3.2t')).toBeInTheDocument();
    expect(screen.getByText(/▼ 8%/)).toBeInTheDocument();
  });
});
