import React from 'react';
import { STATUS_META } from './helpers';

export default function StatusBadge({ status, className = '' }) {
  const meta = STATUS_META[status] || STATUS_META.active;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.cls} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
