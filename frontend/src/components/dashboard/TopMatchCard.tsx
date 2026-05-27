import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { JobCard } from '@/types';
import { kanbanApi } from '@/services/api';
import toast from 'react-hot-toast';

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
  const fmt = (n?: number) => (n != null ? `${sym}${Math.round(n / 1000)}k` : '');
  if (job.salaryMin != null && job.salaryMax != null) {
    return `${fmt(job.salaryMin)} - ${fmt(job.salaryMax)}`;
  }
  if (job.salaryMin != null) return `from ${fmt(job.salaryMin)}`;
  if (job.salaryMax != null) return `up to ${fmt(job.salaryMax)}`;
  return 'Salary on request';
}

type Props = {
  job: JobCard;
  animationDelay?: string;
  onSaved?: () => void;
};

export function TopMatchCard({ job, animationDelay = '0.1s', onSaved }: Props) {
  const [bookmarked, setBookmarked] = useState(job.kanbanColumn === 'Saved');
  const [saving, setSaving] = useState(false);
  const match = job.matchPercent ?? 0;
  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    try {
      const next = bookmarked ? 'Discovered' : 'Saved';
      await kanbanApi.patch(job.userJobId, { kanbanColumn: next });
      setBookmarked(!bookmarked);
      onSaved?.();
    } catch {
      toast.error('Could not update saved jobs');
    } finally {
      setSaving(false);
    }
  };

  const className =
    'welcome-stagger-in block bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-sm hover:border-primary transition-all group';

  const body = (
    <>
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
      <h3 className="font-headline-sm text-headline-sm mb-1 group-hover:text-primary transition-colors text-on-surface">
        {job.title}
      </h3>
      <p className="text-secondary font-body-sm text-body-sm mb-4">
        {job.company}
        {job.location ? ` • ${job.location}` : ''}
      </p>
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant">
        <span className="font-bold text-on-surface">{formatSalary(job)}</span>
        <button
          type="button"
          onClick={toggleBookmark}
          disabled={saving}
          className="p-1 rounded-md hover:bg-surface-container-low transition-colors"
          aria-label={bookmarked ? 'Remove bookmark' : 'Save job'}
        >
          <span
            className={`material-symbols-outlined text-[22px] ${bookmarked ? 'text-primary' : 'text-secondary hover:text-primary'}`}
            style={{ fontVariationSettings: bookmarked ? "'FILL' 1" : "'FILL' 0" }}
          >
            bookmark
          </span>
        </button>
      </div>
    </>
  );

  return (
    <Link to={`/jobs/${job.userJobId}`} className={className} style={{ animationDelay }}>
      {body}
    </Link>
  );
}
