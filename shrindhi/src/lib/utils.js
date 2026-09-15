import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num) {
  if (num === undefined || num === null) return '—';
  return new Intl.NumberFormat('en-IN').format(num);
}
