import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { JobDescriptionView } from '@/components/job-detail/JobDescriptionView';
import { sourceLabel } from '@/lib/jobSource';
import { hasUsableJobDescription, plainJobDescription } from '@/lib/plainJobDescription';
import { queryKeys } from '@/lib/queryKeys';
import { jobsApi } from '@/services/api';
import type { JobDetail, Profile } from '@/types';

type Props = {
  job: JobDetail;
  profile?: Profile | null;
  onDescriptionLoaded?: () => void;
};

export function JobDescriptionSection({ job, profile, onDescriptionLoaded }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const description = plainJobDescription(job.description);
  const hasDescription = hasUsableJobDescription(job.description);
  const looksTruncated = hasDescription && description.length < 500;

  const loadDescription = useCallback(
    async () => {
      if (!job.userJobId) return;
      setLoading(true);
      try {
        const updated = await jobsApi.enrichDescription(job.userJobId);
        queryClient.setQueryData(queryKeys.jobs.detail(job.userJobId), updated);
        if (hasUsableJobDescription(updated.description)) {
          onDescriptionLoaded?.();
        } else {
          toast.error('Could not load the full posting from the source site. Try opening the original listing.');
        }
      } catch {
        toast.error('Could not load the job description. Try again in a moment.');
      } finally {
        setLoading(false);
      }
    },
    [job.userJobId, onDescriptionLoaded, queryClient],
  );

  return (
    <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-outline-variant shadow-sm">
      <h2 className="font-headline-sm text-headline-sm mb-4 text-on-surface">Job Description</h2>

      {looksTruncated && (
        <p className="font-body-sm text-body-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          This posting looks incomplete. Load the full description from the job site.
        </p>
      )}

      {hasDescription ? (
        <div className="mb-2">
          <JobDescriptionView
            description={description}
            title={job.title}
            profile={profile ?? null}
            {...(job.matchedSkills ? { matchedSkills: job.matchedSkills } : {})}
            {...(job.unmatchedSkills ? { unmatchedSkills: job.unmatchedSkills } : {})}
          />
        </div>
      ) : (
        <div className="space-y-4 mb-2">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {loading
              ? 'Loading the full posting from the job site…'
              : 'We could not load the full posting text yet. Try fetching it again, or open the original listing.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadDescription()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-primary font-label-md hover:bg-surface-container-high transition-colors disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[20px]${loading ? ' animate-spin' : ''}`}
              >
                {loading ? 'progress_activity' : 'refresh'}
              </span>
              {loading ? 'Loading…' : looksTruncated ? 'Load full description' : 'Load job description'}
            </button>
            {job.sourceUrl && (
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface font-label-md hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                Open on{' '}
                {sourceLabel(job.sourceName) !== 'Unknown source'
                  ? sourceLabel(job.sourceName)
                  : 'source site'}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
