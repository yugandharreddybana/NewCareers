import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind classes safely, resolving conflicts.
 * Use this everywhere instead of raw template strings.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Converts a number to a compact label: 1200 → "1.2k"
 */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Human-readable relative time: "2h ago", "3d ago"
 */
export function timeAgo(iso: string): string {
  if (!iso) return 'Recently';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

/**
 * Returns a greeting based on the current hour.
 */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Clamps a number between min and max.
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Colour for match score — red → amber → green
 */
export function matchColour(score: number): string {
  if (score >= 80) return 'text-success-600';
  if (score >= 60) return 'text-warning-600';
  return 'text-danger-600';
}

export function matchBg(score: number): string {
  if (score >= 80) return 'bg-success-500';
  if (score >= 60) return 'bg-warning-500';
  return 'bg-danger-500';
}

/**
 * Truncates a string to `n` chars with ellipsis.
 */
export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/**
 * Formats salary values into a readable string.
 */
export function salaryLabel(min?: number, max?: number): string {
  if (min && max) return `€${(min/1000).toFixed(0)}k – €${(max/1000).toFixed(0)}k`;
  if (min)        return `€${(min/1000).toFixed(0)}k+`;
  if (max)        return `Up to €${(max/1000).toFixed(0)}k`;
  return 'Salary not listed';
}

/**
 * Capitalises the first letter of a string.
 */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
