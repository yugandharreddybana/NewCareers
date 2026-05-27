import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { PageMeta } from '@/components/PageMeta';
import { DashboardTopNav } from '@/components/dashboard/DashboardTopNav';
import { TopMatchCard } from '@/components/dashboard/TopMatchCard';
import { SKILL_COUNT } from '@/lib/skillCatalog';
import type { RecommendedJob } from '@/services/discoveryApi';
import { useRecommendedJobs, useFetchLiveJobMutation } from '@/hooks/queries';
import type { JobCard } from '@/types';
import { normalizeJobCard } from '@/lib/normalizeJobCard';
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

function recommendedToJobCard(job: RecommendedJob): JobCard {
  const raw: Partial<JobCard> = {
    userJobId: job.userJobId,
    jobId: job.userJobId,
    title: job.title,
    company: job.company,
    location: job.location,
    matchPercent: job.matchPercent,
    kanbanColumn: 'Discovered',
    status: 'new',
  };
  if (job.salaryMin != null) raw.salaryMin = job.salaryMin;
  if (job.salaryMax != null) raw.salaryMax = job.salaryMax;
  if (job.currency) raw.currency = job.currency;
  if (job.sourceName) raw.sourceName = job.sourceName;
  return normalizeJobCard(raw);
}

type Props = {
  celebrate?: boolean;
};

export function CareersHomeDashboard({ celebrate = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const matchesRef = useRef<HTMLDivElement>(null);

  const {
    data: recommended,
    isLoading: matchesLoading,
    isError: matchesQueryError,
    refetch: refetchRecommended,
  } = useRecommendedJobs({ enabled: Boolean(user) });
  const fetchLive = useFetchLiveJobMutation();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [prependedJob, setPrependedJob] = useState<JobCard | null>(null);

  const jobsFromCache = (recommended ?? []).slice(0, 3).map(recommendedToJobCard);
  const jobs = prependedJob
    ? [prependedJob, ...jobsFromCache.filter(j => j.userJobId !== prependedJob.userJobId)].slice(0, 3)
    : jobsFromCache;

  const matchesError = fetchError ?? (matchesQueryError ? 'Could not load your matches right now.' : null);

  const handleFetchJobs = async () => {
    setFetchError(null);
    try {
      const job = await fetchLive.mutateAsync();
      if (job?.userJobId) {
        toast.success('New job found and added to your pipeline!');
        setPrependedJob(normalizeJobCard(job));
        await refetchRecommended();
      }
    } catch (err: unknown) {
      let msg = 'Could not fetch jobs right now. Please try again later.';
      if (err && typeof err === 'object') {
        const axiosErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
        msg = axiosErr.response?.data?.message ?? axiosErr.response?.data?.error ?? axiosErr.message ?? msg;
      }
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
                  onClick={() => void refetchRecommended()}
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
            {!matchesLoading && jobs.length === 0 && (
              <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 mb-4 text-center">
                <p className="font-body-md text-on-surface-variant mb-3">
                  No pipeline matches yet. Your onboarding job matching is still processing or no live sources returned jobs.
                </p>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {jobs.map((job, i) => (
                <TopMatchCard key={job.userJobId} job={job} animationDelay={`${0.1 + i * 0.1}s`} />
              ))}
            </div>

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

          <div
            className="bg-surface-container rounded-2xl p-8 md:p-12 welcome-stagger-in"
            style={{ animationDelay: '0.4s' }}
          >
            <h2 className="font-headline-md text-headline-md text-on-surface mb-8 text-center">
              Your Fast-Track to Success
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-base md:gap-gutter">
              <div className="flex flex-col items-center text-center p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                <div className="h-10 w-10 bg-primary text-on-primary rounded-full flex items-center justify-center mb-4 font-bold">
                  1
                </div>
                <h4 className="font-headline-sm text-headline-sm mb-2 text-on-surface">
                  Apply to First Job
                </h4>
                <p className="text-body-sm text-body-sm text-secondary">
                  Don&apos;t wait. Candidates who apply in the first 24h are 3x more likely to be interviewed.
                </p>
                <Link
                  to="/jobs"
                  className="mt-4 text-primary font-label-md text-label-md hover:underline"
                >
                  Browse Jobs
                </Link>
              </div>

              <div className="flex flex-col items-center text-center p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                <div className="h-10 w-10 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center mb-4 font-bold">
                  2
                </div>
                <h4 className="font-headline-sm text-headline-sm mb-2 text-on-surface">
                  Refine your CV
                </h4>
                <p className="text-body-sm text-body-sm text-secondary">
                  Our AI tool can help you tailor your resume specifically for the roles you matched with.
                </p>
                <Link to="/cv" className="mt-4 text-primary font-label-md text-label-md hover:underline">
                  Optimise CV
                </Link>
              </div>

              <div className="flex flex-col items-center text-center p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                <div className="h-10 w-10 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center mb-4 font-bold">
                  3
                </div>
                <h4 className="font-headline-sm text-headline-sm mb-2 text-on-surface">
                  Complete Bio
                </h4>
                <p className="text-body-sm text-body-sm text-secondary">
                  Adding a personal summary increases profile visibility to recruiters by up to 45%.
                </p>
                <Link
                  to="/account"
                  className="mt-4 text-primary font-label-md text-label-md hover:underline"
                >
                  Edit settings
                </Link>
              </div>
            </div>
          </div>
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
