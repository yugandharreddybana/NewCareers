/**
 * UI helpers for employment-permit sponsor reliability tiers and scores.
 */

export function getTierColor(tier: string): string {
  switch (tier?.toUpperCase()) {
    case 'ELITE':
      return 'text-amber-600';
    case 'STRONG':
      return 'text-emerald-600';
    case 'CONSISTENT':
      return 'text-sky-600';
    case 'OCCASIONAL':
      return 'text-slate-500';
    case 'NEW':
      return 'text-violet-600';
    case 'INACTIVE':
    default:
      return 'text-slate-400';
  }
}

export function getTierBadgeClass(tier: string): string {
  switch (tier?.toUpperCase()) {
    case 'ELITE':
      return 'bg-amber-100 text-amber-800';
    case 'STRONG':
      return 'bg-emerald-100 text-emerald-800';
    case 'CONSISTENT':
      return 'bg-sky-100 text-sky-800';
    case 'OCCASIONAL':
      return 'bg-slate-100 text-slate-700';
    case 'NEW':
      return 'bg-violet-100 text-violet-800';
    case 'INACTIVE':
    default:
      return 'bg-slate-50 text-slate-500';
  }
}

export function getTierLabel(tier: string): string {
  switch (tier?.toUpperCase()) {
    case 'ELITE':
      return '🏆 Elite Sponsor';
    case 'STRONG':
      return '⭐ Strong Sponsor';
    case 'CONSISTENT':
      return '✅ Consistent';
    case 'OCCASIONAL':
      return '📊 Occasional';
    case 'NEW':
      return '🆕 New to Dataset';
    case 'INACTIVE':
    default:
      return '⚪ No Recent Record';
  }
}

export function getTierDescription(tier: string): string {
  switch (tier?.toUpperCase()) {
    case 'ELITE':
      return 'Sponsored permits 90%+ of years on record';
    case 'STRONG':
      return 'Consistently active across most years';
    case 'CONSISTENT':
      return 'Regularly appears in permit data';
    case 'OCCASIONAL':
      return 'Appeared in some years, gaps in others';
    case 'NEW':
      return 'First appeared in the last 2 years';
    case 'INACTIVE':
    default:
      return 'Not found in recent permit data';
  }
}

/** Display whole-number score (e.g. 94.2 → "94"). */
export function formatReliabilityScore(score: number): string {
  if (!Number.isFinite(score)) return '—';
  return String(Math.round(score));
}

export function getScoreColor(score: number): string {
  if (score > 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}
