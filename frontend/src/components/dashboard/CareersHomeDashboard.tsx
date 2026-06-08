import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { PageMeta } from '@/components/PageMeta';
import { DashboardTopNav } from '@/components/dashboard/DashboardTopNav';
import { TopMatchCard } from '@/components/dashboard/TopMatchCard';
import { SKILL_COUNT } from '@/lib/skillCatalog';
import { useFetchLiveJobMutation, useJobsList } from '@/hooks/queries';
import { onboardingApi, profileApi, type OnboardingDeliveryStatus } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JobCard } from '@/types';
import { isApiError } from '@/types';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { normalizeJobCard } from '@/lib/normalizeJobCard';
import { fetchJobsOrchestrated, pollPipelineJobSearch } from '@/lib/pipelineJobSearch';
import { DashboardUserAnalytics } from '@/components/dashboard/DashboardUserAnalytics';
import '@/styles/welcome-dashboard.css';

export const WELCOME_PENDING_KEY = 'nc_welcome_pending';

export function readWelcomePendingFlag(): boolean {
  try {
    return sessionStorage.getItem(WELCOME_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearWelcomePendingFlag(): void {
  try {
    sessionStorage.removeItem(WELCOME_PENDING_KEY);
  } catch {
    // ignore
  }
}

/** Auto-scrolling infinite loop of top match cards (marquee). Pauses on hover. */
function TopMatchesMarquee({ jobs }: { jobs: JobCard[] }) {
  const loopJobs = jobs.length === 1 ? [jobs[0]!, jobs[0]!] : [...jobs, ...jobs];
  const durationSec = Math.max(32, jobs.length * 7);

  return (
    <div
      className="marquee-container marquee-container--cards py-1 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]"
      aria-label="Top job matches carousel"
    >
      <div
        className="marquee-content inline-flex items-stretch gap-gutter"
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loopJobs.map((job, i) => (
          <div
            key={`${job.userJobId}-${i}`}
            className="shrink-0 w-[min(88vw,320px)] sm:w-[340px] min-w-0 overflow-hidden"
          >
            <TopMatchCard job={job} animationDelay="0s" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function setWelcomePendingFlag(): void {
  try {
    sessionStorage.setItem(WELCOME_PENDING_KEY, '1');
  } catch {
    // ignore
  }
}

function firstName(full?: string | null): string {
  if (!full?.trim()) return 'there';
  return full.trim().split(/\s+/)[0] ?? 'there';
}

const ACTIVE_DELIVERY_STAGES = new Set([
  'reading_cv',
  'normalizing_cv',
  'fetching_jobs',
  'evaluating_jobs',
]);

/** Never surface SQL / stack traces from delivery status to the dashboard. */
function sanitizeDeliveryError(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  if (/duplicate key|constraint|jdbc|hibernate|insert into|org\.|sql\b/i.test(raw) || raw.length > 240) {
    return 'Job matching hit a snag — try again in a moment.';
  }
  return raw;
}

function emptyMatchesMessage(
  delivery: OnboardingDeliveryStatus | undefined,
  visibleMatches: number,
  pipelineTotal: number,
  minMatchHint?: number,
): string {
  if (visibleMatches > 0) {
    return `You have ${visibleMatches} role${visibleMatches === 1 ? '' : 's'} matching your filters — open the job board to view them.`;
  }
  if (pipelineTotal > 0 && minMatchHint != null) {
    return `${pipelineTotal} role${pipelineTotal === 1 ? '' : 's'} in your tracker are below your ${minMatchHint}% match threshold. Lower the minimum on Account settings or use Find Jobs Now.`;
  }
  if (!delivery || delivery.stage === 'idle') {
    return 'Job matching has not run yet. Finish onboarding (upload a CV on the last step) or use Run job matching below.';
  }
  if (delivery.stage === 'failed') {
    return (
      sanitizeDeliveryError(delivery.error) ??
      delivery.message ??
      'Job matching could not find enough roles that pass your filters.'
    );
  }
  if (ACTIVE_DELIVERY_STAGES.has(delivery.stage)) {
    return `${delivery.message || 'Still matching jobs…'} Refresh in a moment or wait for matching to finish.`;
  }
  if (delivery.stage === 'ready' || delivery.stage === 'ready_partial') {
    return 'Matching finished, but no roles matched your target roles and location yet. Try Fetch jobs on the tracker or run job matching again.';
  }
  return 'No pipeline matches yet. Your onboarding job matching may still be processing, or live sources returned no roles that passed your filters.';
}

type Props = {
  celebrate?: boolean;
  /** Rendered after top matches, before user analytics (e.g. permit intelligence). */
  beforeFastTrack?: ReactNode;
};

export function CareersHomeDashboard({ celebrate = false, beforeFastTrack }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const matchesRef = useRef<HTMLDivElement>(null);
  const pipelineAbortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => () => { pipelineAbortRef.current?.abort(); }, []);

  useEffect(() => {
    if (celebrate) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    }
  }, [celebrate, queryClient]);

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: () => profileApi.get(),
    enabled: Boolean(user),
  });
  const { data: jobsList, isLoading: matchesLoading, isError: matchesQueryError, refetch: refetchJobs } =
    useJobsList({ enabled: Boolean(user) });
  const fetchLive = useFetchLiveJobMutation();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [prependedJob, setPrependedJob] = useState<JobCard | null>(null);
  const [matchingInFlight, setMatchingInFlight] = useState(false);

  /** Same filtered pipeline as /jobs (server applies profile minMatchPercent). */
  const jobsFromPipeline = (jobsList?.items ?? []).slice(0, 12);
  const jobs = prependedJob
    ? [prependedJob, ...jobsFromPipeline.filter(j => j.userJobId !== prependedJob.userJobId)].slice(0, 12)
    : jobsFromPipeline;
  const visibleMatches = jobsList?.totalCount ?? jobsFromPipeline.length;
  const pipelineTotal = jobsList?.pipelineTotal ?? visibleMatches;

  const showDeliveryStatus = Boolean(user) && !matchesLoading && jobs.length === 0;

  const runMatching = useMutation({
    mutationFn: () => onboardingApi.startDelivery(true),
    onMutate: () => {
      setMatchingInFlight(true);
    },
    onSuccess: (data) => {
      const active = ['reading_cv', 'normalizing_cv', 'fetching_jobs', 'evaluating_jobs'].includes(
        data.stage?.toLowerCase() ?? '',
      );
      toast.success(
        active
          ? 'Job matching started — this can take a few minutes.'
          : (data.message || 'Job matching is already up to date.'),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.delivery() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    },
    onError: (err: unknown) => {
      setMatchingInFlight(false);
      toast.error(getUserFacingErrorMessage(err, 'Could not start job matching.'));
    },
  });

  const { data: deliveryStatus } = useQuery({
    queryKey: queryKeys.onboarding.delivery(),
    queryFn: () => onboardingApi.deliveryStatus(),
    enabled: showDeliveryStatus || matchingInFlight,
    refetchInterval: query => {
      const stage = query.state.data?.stage ?? '';
      if (ACTIVE_DELIVERY_STAGES.has(stage) || runMatching.isPending || matchingInFlight) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
        return 3000;
      }
      return false;
    },
  });

  const isMatchingActive =
    runMatching.isPending
    || matchingInFlight
    || ACTIVE_DELIVERY_STAGES.has(deliveryStatus?.stage ?? '');

  useEffect(() => {
    const stage = deliveryStatus?.stage ?? '';
    if (!matchingInFlight) return;
    if (stage === 'ready' || stage === 'ready_partial' || stage === 'failed' || stage === 'idle') {
      setMatchingInFlight(false);
    }
  }, [deliveryStatus?.stage, matchingInFlight]);

  const matchesError =
    fetchError
    ?? (matchesQueryError && jobsFromPipeline.length === 0 ? 'Could not load your matches right now.' : null);

  const handleFetchJobs = async () => {
    setFetchError(null);
    if (pipelineTotal === 0) {
      pipelineAbortRef.current?.abort();
      const controller = new AbortController();
      pipelineAbortRef.current = controller;
      setMatchingInFlight(true);
      try {
        await fetchJobsOrchestrated(5, undefined, controller.signal);
        await refetchJobs();
        toast.success('Job search complete — your matches are on the tracker.');
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = getUserFacingErrorMessage(err, 'Could not run job search right now.');
        setFetchError(msg);
        toast.error(msg);
      } finally {
        setMatchingInFlight(false);
      }
      return;
    }
    try {
      const job = await fetchLive.mutateAsync();
      if (job?.userJobId) {
        toast.success('New job found and added to your pipeline!');
        setPrependedJob(normalizeJobCard(job));
        await refetchJobs();
      }
    } catch (err: unknown) {
      if (isApiError(err) && err.status === 202) {
        pipelineAbortRef.current?.abort();
        const controller = new AbortController();
        pipelineAbortRef.current = controller;
        setMatchingInFlight(true);
        try {
          await pollPipelineJobSearch(undefined, controller.signal);
          await refetchJobs();
          toast.success('Job search started — your matches are loading.');
        } catch (pollErr: unknown) {
          if (pollErr instanceof DOMException && pollErr.name === 'AbortError') return;
          const msg = getUserFacingErrorMessage(pollErr, 'Could not run job search right now.');
          setFetchError(msg);
          toast.error(msg);
        } finally {
          setMatchingInFlight(false);
        }
        return;
      }
      const msg = getUserFacingErrorMessage(err, 'Could not fetch jobs right now. Please try again later.');
      setFetchError(msg);
      toast.error(msg);
    }
  };

  const displayName = firstName(user?.name);

  const clearWelcomeState = useCallback(() => {
    clearWelcomePendingFlag();
    if (window.location.search.includes('welcome')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const scrollToMatches = useCallback(() => {
    clearWelcomeState();
    matchesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [clearWelcomeState]);

  const primaryLiveJob = jobs[0] ?? null;

  return (
    <div className="bg-background font-body-md text-on-background min-h-screen flex flex-col overflow-x-hidden">
      <PageMeta title={celebrate ? "You're all set | NewCareers" : 'Dashboard | NewCareers'} />
      <DashboardTopNav />

      <main className="flex-grow">
        <section className="welcome-bg-radial-premium py-16 md:py-24 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none welcome-dot-grid" />
          <div className="max-w-4xl mx-auto px-margin-mobile text-center relative z-10">
            {celebrate && (
              <div className="mb-6 inline-flex items-center justify-center h-24 w-24 rounded-full bg-primary-container/20 border-2 border-primary-fixed-dim/30 animate-pulse">
                <span className="material-symbols-outlined text-6xl text-primary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
            )}
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg mb-4 tracking-tight">
              {celebrate ? `You're all set, ${displayName}!` : `Welcome back, ${displayName}`}
            </h1>
            <p className="font-body-lg text-body-lg text-secondary-fixed opacity-90 max-w-2xl mx-auto mb-10">
              {celebrate
                ? 'Your profile is live and the algorithm has already identified high-potential opportunities for your career path.'
                : 'Your top matches are ready - pick a role and move your pipeline forward.'}
            </p>
            <button
              type="button"
              onClick={scrollToMatches}
              className="relative overflow-hidden group px-8 py-4 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              <span className="relative z-10">{celebrate ? 'Go to Dashboard' : 'View top matches'}</span>
              <div className="absolute inset-0 welcome-shimmer" aria-hidden />
            </button>
          </div>
        </section>

        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop -mt-10 mb-20">
          <div ref={matchesRef} id="top-matches" className="mb-12 scroll-mt-24">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline-md text-headline-md text-on-surface">Your Top Matches</h2>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => void refetchJobs()}
                  disabled={matchesLoading}
                  className="text-primary font-label-md text-label-md hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh matches"
                >
                  {matchesLoading ? 'Loading…' : 'Refresh'}
                </button>
                <Link to="/jobs" className="text-primary font-label-md text-label-md hover:underline">
                  View all matches
                </Link>
              </div>
            </div>

            {matchesLoading && (
              <p className="text-body-sm text-secondary mb-4" role="status">
                Loading your latest matches...
              </p>
            )}
            {matchesError && (
              <p className="text-body-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4" role="alert">
                {matchesError}
              </p>
            )}
            {isMatchingActive && jobs.length === 0 && (
              <div
                className="flex items-center justify-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 mb-4"
                role="status"
                aria-live="polite"
              >
                <span className="inline-block h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                <p className="font-body-sm text-on-surface">
                  {deliveryStatus?.message || 'Matching jobs to your profile…'}
                </p>
              </div>
            )}
            {!matchesLoading && jobs.length === 0 && (
              <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 mb-4 text-center">
                <p className="font-body-md text-on-surface-variant mb-3">
                  {isMatchingActive
                    ? (deliveryStatus?.message || 'Matching jobs to your profile…')
                    : emptyMatchesMessage(
                    deliveryStatus,
                    visibleMatches,
                    pipelineTotal,
                    profile?.minMatchPercent ?? 70,
                  )}
                </p>
                {pipelineTotal > 0 && visibleMatches === 0 && (
                  <Link
                    to="/account"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface font-label-md hover:bg-surface-container-high mb-3 mr-2"
                  >
                    Adjust match threshold
                  </Link>
                )}
                {visibleMatches > 0 && (
                  <Link
                    to="/jobs"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-primary text-primary font-label-md hover:bg-primary/5 mb-3"
                  >
                    Open job tracker
                  </Link>
                )}
                {pipelineTotal === 0 && (
                  <button
                    type="button"
                    onClick={() => void runMatching.mutate()}
                    disabled={isMatchingActive}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-primary text-primary font-label-md hover:bg-primary/5 mb-3 mr-2 disabled:opacity-50"
                  >
                    {isMatchingActive ? (
                      <>
                        <span className="inline-block h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Matching…
                      </>
                    ) : (
                      'Run job matching'
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFetchJobs}
                  disabled={fetchLive.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {fetchLive.isPending ? (
                    <>
                      <span className="inline-block h-4 w-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      Fetching jobs…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        search
                      </span>
                      Find Jobs Now
                    </>
                  )}
                </button>
              </div>
            )}

            {jobs.length > 0 && (
              <TopMatchesMarquee jobs={jobs} />
            )}

            {primaryLiveJob && (
              <div className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-label-md text-primary font-semibold uppercase tracking-wide text-xs mb-1">
                    Try AI skills on a real job
                  </p>
                  <p className="font-body-sm text-on-surface-variant">
                    Open <strong className="text-on-surface">{primaryLiveJob.title}</strong> and use Tailor My CV, Evaluate, and {SKILL_COUNT} other skills on live data.
                  </p>
                </div>
                <Link
                  to={`/jobs/${primaryLiveJob.userJobId}?tab=skills`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 shrink-0"
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                  Open skills coach
                </Link>
              </div>
            )}
          </div>

          {beforeFastTrack}

          <DashboardUserAnalytics />

          {/*
          ── Fast-Track to Success (disabled — replaced by DashboardUserAnalytics) ──
          <div
            className="bg-surface-container rounded-2xl p-8 md:p-12 welcome-stagger-in"
            style={{ animationDelay: '0.4s' }}
          >
            <h2 className="font-headline-md text-headline-md text-on-surface mb-8 text-center">
              Your Fast-Track to Success
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-base md:gap-gutter">
              ... Apply to First Job / Refine CV / Complete Bio cards ...
            </div>
          </div>
          */}
        </div>
      </main>

      <footer className="w-full py-8 mt-auto bg-surface-container-lowest border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto gap-base">
          <div className="font-headline-sm text-headline-sm font-black text-on-surface">NewCareers</div>
          <div className="flex flex-wrap justify-center gap-6">
            <a href="#" className="font-label-sm text-label-sm text-on-secondary-container hover:text-primary underline opacity-80 hover:opacity-100 transition-opacity">
              Privacy Policy
            </a>
            <a href="#" className="font-label-sm text-label-sm text-on-secondary-container hover:text-primary underline opacity-80 hover:opacity-100 transition-opacity">
              Terms of Service
            </a>
            <a href="#" className="font-label-sm text-label-sm text-on-secondary-container hover:text-primary underline opacity-80 hover:opacity-100 transition-opacity">
              Help Center
            </a>
            <a href="#" className="font-label-sm text-label-sm text-on-secondary-container hover:text-primary underline opacity-80 hover:opacity-100 transition-opacity">
              Contact Support
            </a>
          </div>
          <div className="font-label-md text-label-md text-secondary opacity-60">
            © {new Date().getFullYear()} NewCareers SaaS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
