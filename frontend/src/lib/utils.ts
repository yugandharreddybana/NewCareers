import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes safely, resolving conflicts.
 * Use this instead of raw `clsx` for all component class composition.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as a compact string (1200 → 1.2k) */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** Format salary numbers → '€65k – €85k' */
export function formatSalary(min?: number, max?: number): string {
  if (min && max) return `€${(min / 1000).toFixed(0)}k – €${(max / 1000).toFixed(0)}k`;
  if (min)        return `€${(min / 1000).toFixed(0)}k+`;
  if (max)        return `Up to €${(max / 1000).toFixed(0)}k`;
  return 'Negotiable';
}

/** Time-ago (ISO string → '2h ago') */
export function timeAgo(iso: string): string {
  if (!iso) return 'Recently';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

/** Greeting based on time of day */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Get user initials from name */
export function initials(name?: string): string {
  if (!name) return 'U';
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
