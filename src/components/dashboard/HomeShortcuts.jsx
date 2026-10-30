import React from 'react';
import { Link } from 'react-router-dom';

const tileCls = 'surface surface-hover pressable flex h-full min-h-[80px] flex-col items-center justify-center gap-1.5 !rounded-2xl px-1 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

const Tile = ({ icon: Icon, label, badge }) => (
  <>
    <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/15 text-amber-800 dark:text-brand">
      <Icon className="h-5 w-5" aria-hidden="true" />
      {badge && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-900" aria-hidden="true" />}
    </span>
    <span className="text-[11px] font-bold leading-tight text-gray-800 dark:text-gray-100">{label}</span>
  </>
);

/** Atalhos da Home em uma fileira (4 colunas em 390 px). items: [{ key, label, icon, to? | onClick?, badge?, ariaLabel? }] */
export default function HomeShortcuts({ items }) {
  return (
    <nav aria-label="Atalhos">
      <ul className="grid grid-cols-4 gap-2 sm:gap-3">
        {items.map((it) => (
          <li key={it.key} className="min-w-0 h-full">
            {it.to ? (
              <Link to={it.to} aria-label={it.ariaLabel} className={tileCls}><Tile {...it} /></Link>
            ) : (
              <button type="button" onClick={it.onClick} aria-label={it.ariaLabel} className={`${tileCls} w-full`}><Tile {...it} /></button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
