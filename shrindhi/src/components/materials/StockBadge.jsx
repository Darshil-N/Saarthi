import React from 'react';

/**
 * StockBadge
 * Restrained status indicator using a subtle colored dot + text.
 * Avoids heavy pill badges to reduce visual noise.
 */
export function StockBadge({ status, className = '' }) {
  const normalized = (status || '').toLowerCase();

  switch (normalized) {
    case 'good':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
          Good
        </span>
      );
    case 'low':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
          Low
        </span>
      );
    case 'critical':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 font-medium ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
          Critical
        </span>
      );
    case 'empty':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs text-slate-500 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
          Empty
        </span>
      );
  }
}

export default StockBadge;
