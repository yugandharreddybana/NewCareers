import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes safely.
 * Combines clsx (conditional classes) + tailwind-merge (deduplication).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a date string as "X time ago" */
export function timeAgo(iso: string): string {
  if (!iso) return 'Recently';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

/** Capitalise first letter of every word */
export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Format salary number: 75000 → "€75k" */
export function formatSalary(n?: number | null): string {
  if (!n) return '';
  return n >= 1000 ? `€${Math.round(n / 1000)}k` : `€${n}`;
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Get colour class for match % score */
export function matchColor(pct?: number | null): string {
  if (!pct) return 'text-text-muted';
  if (pct >= 80) return 'text-success';
  if (pct >= 60) return 'text-warning';
  return 'text-danger';
}

/** Get bg colour class for match % score */
export function matchBg(pct?: number | null): string {
  if (!pct) return 'bg-slate-100';
  if (pct >= 80) return 'bg-success-light border-success-border';
  if (pct >= 60) return 'bg-warning-light border-warning-border';
  return 'bg-danger-light border-danger-border';
}
