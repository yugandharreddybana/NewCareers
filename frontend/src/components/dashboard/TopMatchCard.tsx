/**
 * TopMatchCard.tsx — Batch 5
 *
 * Changes over previous version:
 *   B5.010 – Wrapped with React.memo so the marquee does not re-render every
 *            card when unrelated parent state changes (e.g. fetchLive spinner).
 *   B5.011 – toggleBookmark is stable via useCallback (no new function each
 *            render, so memo comparison stays clean).
 *   B5.012 – Optimistic bookmark toggle: state flips immediately, API call
 *            runs in background; on error the flip is reverted and a toast
 *            is shown. No spinner needed — the icon swap IS the feedback.
 *   B5.013 – formatSalary and avatarColor moved outside the component so
 *            they are never recreated.
 */
import { memo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { JobCard } from '@/types';
import { JobSourceBadge } from '@/components/ui/JobSourceBadge';
import { kanbanApi } from '@/services/api';
import toast from 'react-hot-toast';

// ── Pure helpers (defined once, never recreated) ─────────────────────────
const AVATAR_COLORS = [
  'bg-primary-fixed/20 text-primary',
  'bg-secondary-container text-on-secondary-container',
  'bg-tertiary-fixed/30 text-tertiary',
];

function companyInitials(company: string): string {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function avatarColor(company: string): string {
  let hash = 0;
  for (let i = 0; i < company.length; i++) hash = company.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function formatSalary(job: JobCard): string {
  const sym = job.currency === 'GBP' ? '£' : job.currency === 'USD' ? '$' : '€';
  const fmt = (n?: number) => (n != null ? `${sym}${Math.round(n / 1_000)}k` : '');
  if (job.salaryMin != null && job.salaryMax != null) return `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`;
  if (job.salaryMin != null) return `from ${fmt(job.salaryMin)}`;
  if (job.salaryMax != null) return `up to ${fmt(job.salaryMax)}`;
  return 'Salary on request';
}

// ── Component ─────────────────────────────────────────────────────────────
type Props = {
  job: JobCard;
  animationDelay?: string;
  onSaved?: () => void;
};

export const TopMatchCard = memo(function TopMatchCard({
  job,
  animationDelay = '0.1s',
  onSaved,
}: Props) {
  // B5.012 – optimistic local state; initialise from job.kanbanColumn
  const [bookmarked, setBookmarked] = useState(job.kanbanColumn === 'Saved');
  const match = job.matchPercent ?? 0;

  // B5.011 – stable callback; does NOT depend on `saving` state so no
  //           intermediate re-renders during the async call
  const toggleBookmark = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // B5.012 – flip immediately (optimistic)
      const next = bookmarked ? 'Discovered' : 'Saved';
      setBookmarked(prev => !prev);
      try {
        await kanbanApi.patch(job.userJobId, { kanbanColumn: next });
        onSaved?.();
      } catch {
        // Revert on failure
        setBookmarked(prev => !prev);
        toast.error('Could not update saved jobs');
      }
    },
    [bookmarked, job.userJobId, onSaved],
  );

  const cardClass =
    'welcome-stagger-in block h-full min-w-0 w-full overflow-hidden ' +
    'bg-surface-container-lowest border border-outline-variant p-6 rounded-xl ' +
    'shadow-sm hover:border-primary transition-all group';

  return (
    <Link to={`/jobs/${job.userJobId}`} className={cardClass} style={{ animationDelay }}>
      <div className="flex justify-between items-start mb-4">
        <div
          className={`h-12 w-12 rounded-lg flex items-center justify-center font-headline-sm text-headline-sm ${avatarColor(job.company)}`}
        >
          {companyInitials(job.company)}
        </div>
        <span className="px-3 py-1 bg-primary-fixed/30 text-primary font-label-sm text-label-sm rounded-full">
          {match}% Match
        </span>
      </div>

      <h3 className="font-headline-sm text-headline-sm mb-1 group-hover:text-primary transition-colors text-on-surface line-clamp-2 leading-snug">
        {job.title}
      </h3>
      <p className="text-secondary font-body-sm text-body-sm mb-2 truncate">
        {job.company}
        {job.location ? ` • ${job.location}` : ''}
      </p>
      {job.sourceName ? (
        <div className="mb-4">
          <JobSourceBadge name={job.sourceName} />
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-4 border-t border-outline-variant">
        <span className="font-bold text-on-surface">{formatSalary(job)}</span>
        <button
          type="button"
          onClick={toggleBookmark}
          className="p-1 rounded-md hover:bg-surface-container-low transition-colors"
          aria-label={bookmarked ? 'Remove bookmark' : 'Save job'}
        >
          <span
            className={`material-symbols-outlined text-[22px] ${
              bookmarked ? 'text-primary' : 'text-secondary hover:text-primary'
            }`}
            style={{ fontVariationSettings: bookmarked ? "'FILL' 1" : "'FILL' 0" }}
          >
            bookmark
          </span>
        </button>
      </div>
    </Link>
  );
});
