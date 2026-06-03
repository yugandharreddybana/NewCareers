import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as a compact string (1200 → 1.2k) */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/** Return relative time string from ISO date */
export function timeAgo(iso: string): string {
  if (!iso) return 'Recently';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' });
}

/** Exact local date/time when a job was pulled into the pipeline (deliveredAt). */
export function formatPulledAt(iso?: string | null): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Greeting based on current hour */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Format salary range */
export function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Negotiable';
  if (min && max)   return `€${(min/1000).toFixed(0)}k – €${(max/1000).toFixed(0)}k`;
  if (min)          return `€${(min/1000).toFixed(0)}k+`;
  return `Up to €${(max!/1000).toFixed(0)}k`;
}

/** Get initials from full name */
export function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}
