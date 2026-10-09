import React from 'react';
import { initials } from './helpers';

const SIZES = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' };

// Avatar com foto ou iniciais.
export default function Avatar({ name, src, size = 'md', className = '' }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-orange-500 font-black text-black shadow-md ${SIZES[size] || SIZES.md} ${className}`}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
