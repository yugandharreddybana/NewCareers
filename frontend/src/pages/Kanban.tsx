import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { DashboardTopNav } from '@/components/dashboard/DashboardTopNav';
import { useQuery } from '@tanstack/react-query';
import {
  useJobsList,
  useFetchIrishJobsMutation,
  useFetchLiveJobMutation,
  useKanbanPatchMutation,
} from '@/hooks/queries/useJobs';
import { profileApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import { isApiError, type FetchSummary, type JobCard } from '@/types';

type ViewMode = 'board' | 'list';
const STAGE_OPTIONS: JobCard['kanbanColumn'][] = ['Saved', 'Applied', 'Interview', 'Offer', 'Discovered', 'Rejected'];

function timeAgoLabel(iso?: string): string {
  if (!iso) return 'Recently';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return 'Recently';
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function columnLabel(col: JobCard['kanbanColumn']): string {
  if (col === 'Interview') return 'Interviewing';
  if (col === 'Rejected') return 'Archived';
  return col;
}

function columnDotClass(col: JobCard['kanbanColumn']): string {
  if (col === 'Saved') return 'bg-tertiary';
  if (col === 'Applied') return 'bg-primary';
  if (col === 'Interview') return 'bg-secondary';
  if (col === 'Offer') return 'bg-primary-container';
  return 'bg-outline';
}

const Kanban: React.FC = () => {
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: () => profileApi.get(),
  });
  const profileMinMatch = profile?.minMatchPercent ?? 60;

  const { data: jobsData, isLoading: loading, isError } = useJobsList();
  const jobs = jobsData?.items ?? [];
  const fetchIrish = useFetchIrishJobsMutation();
  const fetchLive = useFetchLiveJobMutation();
  const kanbanPatch = useKanbanPatchMutation();

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [listQuery, setListQuery] = useState('');
  const [listStageFilter, setListStageFilter] = useState<'ALL' | JobCard['kanbanColumn']>('ALL');
  const [listMinMatch, setListMinMatch] = useState(profileMinMatch);
  const [optimisticJobs, setOptimisticJobs] = useState<JobCard[] | null>(null);

  useEffect(() => {
    setListMinMatch(profileMinMatch);
  }, [profileMinMatch]);

  const meetsProfileMinMatch = useCallback(
    (job: JobCard) => (job.matchPercent ?? 0) >= profileMinMatch,
    [profileMinMatch],
  );

  const boardJobs = useMemo(() => {
    const source = optimisticJobs ?? jobs;
    return source.filter(meetsProfileMinMatch);
  }, [optimisticJobs, jobs, meetsProfileMinMatch]);

  const matchesMinFilter = useCallback(
    (job: JobCard) => (job.matchPercent ?? 0) >= listMinMatch,
    [listMinMatch],
  );

  const handleFetchJobs = async () => {
    try {
      const summary = (await fetchIrish.mutateAsync(10)) as FetchSummary;
      const n = summary.delivered ?? 0;
      if (n > 0) {
        toast.success(`Added ${n} job${n === 1 ? '' : 's'} to your tracker.`);
        return;
      }
      toast('No new Irish roles passed your match threshold. Trying one live match…');
    } catch (e) {
      toast.error(isApiError(e) ? e.normalizedMessage : 'IrishJobs fetch failed; trying one live match…');
    }

    try {
      const liveJob = await fetchLive.mutateAsync();
      toast.success(`Added: ${liveJob.title} at ${liveJob.company}`);
    } catch (e) {
      toast.error(isApiError(e) ? e.normalizedMessage : 'Failed to fetch jobs');
    }
  };

  const listJobs = boardJobs.filter(job => {
    if (!matchesMinFilter(job)) return false;
    const q = listQuery.trim().toLowerCase();
    const queryMatch = !q ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q);
    const stageMatch = listStageFilter === 'ALL' || job.kanbanColumn === listStageFilter;
    return queryMatch && stageMatch;
  });

  async function handleListStageChange(job: JobCard, nextStage: JobCard['kanbanColumn']) {
    const prev = boardJobs;
    setOptimisticJobs(prev.map(item => (
      item.userJobId === job.userJobId ? { ...item, kanbanColumn: nextStage } : item
    )));

    try {
      await kanbanPatch.mutateAsync({
        userJobId: job.userJobId,
        body: { kanbanColumn: nextStage },
      });
      setOptimisticJobs(null);
    } catch (e) {
      toast.error(isApiError(e) ? e.normalizedMessage : 'Failed to move job stage');
      setOptimisticJobs(null);
    }
  }

  return (
    <>
      <PageMeta title="Job Tracker | NewCareers" />
      <div className="bg-background text-on-background min-h-screen flex flex-col">
        <DashboardTopNav />

        <main className="flex-grow flex flex-col p-margin-mobile md:p-margin-desktop gap-gutter max-w-container-max mx-auto w-full">
          <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">Application Pipeline</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Manage and track your career progression through the funnel.
                {profileMinMatch > 0 && (
                  <span className="block mt-1 text-sm">
                    Showing roles at or above your {profileMinMatch}% minimum match.
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-surface-container-low p-1 rounded-lg flex border border-outline-variant">
                <button
                  type="button"
                  onClick={() => setViewMode('board')}
                  className={`px-3 py-1.5 flex items-center gap-2 rounded-md font-label-md text-label-md transition-colors ${
                    viewMode === 'board'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">view_kanban</span>
                  Board
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 flex items-center gap-2 rounded-md font-label-md text-label-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">list</span>
                  List
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleFetchJobs()}
                disabled={fetchIrish.isPending || fetchLive.isPending}
                className="px-4 py-1.5 flex items-center gap-2 rounded-md font-label-md text-label-md transition-colors bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {fetchIrish.isPending || fetchLive.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">download</span>
                )}
                {fetchIrish.isPending || fetchLive.isPending ? 'Fetching...' : 'Fetch Jobs'}
              </button>
            </div>
          </section>

          {loading && (
            <div className="py-10">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!loading && (
            <>
              {isError && (
                <div className="rounded-lg border border-error/20 bg-error-container text-on-error-container px-4 py-3 text-sm">
                  Failed to load jobs.
                </div>
              )}
              {viewMode === 'board' ? (
                <KanbanBoard
                  jobs={boardJobs}
                  onJobClick={job => navigate(`/jobs/${job.userJobId}`)}
                />
              ) : (
                <section className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[220px] flex-1">
                      <span className="material-symbols-outlined text-outline absolute left-3 top-1/2 -translate-y-1/2 text-[18px]">
                        search
                      </span>
                      <input
                        type="text"
                        value={listQuery}
                        onChange={e => setListQuery(e.target.value)}
                        placeholder="Search role, company, or location"
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <select
                      value={listStageFilter}
                      onChange={e => setListStageFilter(e.target.value as 'ALL' | JobCard['kanbanColumn'])}
                      className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="ALL">All stages</option>
                      {STAGE_OPTIONS.map(stage => (
                        <option key={stage} value={stage}>
                          {columnLabel(stage)}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                      <span className="whitespace-nowrap">Min match</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={listMinMatch}
                        onChange={e => setListMinMatch(Number(e.target.value))}
                        className="w-28 accent-primary"
                        aria-label="Minimum match percent filter"
                      />
                      <span className="text-primary font-medium tabular-nums w-10">{listMinMatch}%</span>
                    </label>
                    <span className="text-on-surface-variant font-label-sm text-label-sm">
                      {listJobs.length} result{listJobs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-[2fr_1.25fr_0.8fr_1.2fr_1fr_0.7fr] gap-4 px-6 py-3 bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm">
                    <span>Role</span>
                    <span>Company</span>
                    <span>Match</span>
                    <span>Status</span>
                    <span>Updated</span>
                    <span className="text-right">Action</span>
                  </div>
                  <div className="divide-y divide-outline-variant/50">
                    {listJobs.map(job => (
                      <div
                        key={job.userJobId}
                        className="grid grid-cols-[2fr_1.25fr_0.8fr_1.2fr_1fr_0.7fr] gap-4 items-center px-6 py-4 hover:bg-surface-container-low transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-headline-sm text-[15px] text-on-surface truncate">{job.title}</p>
                          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{job.location}</p>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface truncate">{job.company}</p>
                        <div>
                          <span className="text-primary bg-primary-fixed text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
                            {job.matchPercent ?? 0}% Match
                          </span>
                        </div>
                        <label className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${columnDotClass(job.kanbanColumn)}`} />
                          <select
                            value={job.kanbanColumn}
                            onChange={e => handleListStageChange(job, e.target.value as JobCard['kanbanColumn'])}
                            className="bg-transparent border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
                          >
                            {STAGE_OPTIONS.map(stage => (
                              <option key={stage} value={stage}>
                                {columnLabel(stage)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">{timeAgoLabel(job.deliveredAt ?? job.postedAt)}</span>
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/jobs/${job.userJobId}`)}
                            className="inline-flex items-center gap-1 text-primary font-label-sm text-label-sm hover:underline"
                          >
                            Open
                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                          </button>
                        </div>
                      </div>
                    ))}
                    {listJobs.length === 0 && (
                      <div className="px-6 py-10 text-center text-on-surface-variant text-sm">
                        No jobs match the current filters.
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        <footer className="bg-surface-container-lowest border-t border-outline-variant mt-auto">
          <div className="w-full py-8 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center max-w-container-max mx-auto gap-4">
            <div className="flex flex-col items-center md:items-start gap-2">
              <span className="font-label-md text-label-md font-bold text-primary">NewCareers Premium</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                © 2024 NewCareers Premium. All rights reserved.
              </p>
            </div>
            <nav className="flex gap-6 flex-wrap justify-center">
              <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors" to="/privacy">Privacy Policy</Link>
              <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors" to="/terms">Terms of Service</Link>
              <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Help Center</a>
              <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Contact Support</a>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Kanban;
