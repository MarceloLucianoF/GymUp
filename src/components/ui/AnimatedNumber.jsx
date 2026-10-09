import React, { useEffect, useRef, useState } from 'react';

// Contador animado (easeOutExpo). Respeita prefers-reduced-motion.
export default function AnimatedNumber({ value = 0, duration = 1100, decimals = 0, prefix = '', suffix = '', className = '' }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(target);
      return undefined;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const formatted = display.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className={className}>{prefix}{formatted}{suffix}</span>;
}
