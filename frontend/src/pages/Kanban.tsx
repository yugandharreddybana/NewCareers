import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { PipelineSkillActions } from '@/components/kanban/PipelineSkillActions';
import {
  useJobsList,
  useKanbanPatchMutation,
} from '@/hooks/queries/useJobs';
import { useAuth } from '@/context/authCtx';
import { useProfileQuery } from '@/hooks/queries';
import { isApiError, type JobCard } from '@/types';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { fetchJobsOrchestrated } from '@/lib/pipelineJobSearch';
import { JobSourceBadge } from '@/components/ui/JobSourceBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { sourceLabel } from '@/lib/jobSource';
import { formatPulledAt } from '@/lib/utils';
import { jobsApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';

type ViewMode = 'board' | 'list';
/** Board + list filter — bookmarked jobs count under Discovered. */
const STAGE_OPTIONS: JobCard['kanbanColumn'][] = ['Discovered', 'Applied', 'Interview', 'Offer', 'Rejected'];
/** List row editor — includes bookmark state. */
const LIST_ROW_STAGE_OPTIONS: JobCard['kanbanColumn'][] = ['Discovered', 'Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

function timeAgoLabel(iso?: string): string {
  return formatPulledAt(iso);
}

function columnLabel(col: JobCard['kanbanColumn']): string {
  if (col === 'Interview') return 'Interviewing';
  if (col === 'Rejected') return 'Archived';
  if (col === 'Saved') return 'Discovered (saved)';
  return col;
}

/** Shared min width so list columns stay aligned (table layout). */
const LIST_TABLE_MIN_W = 'min-w-[980px]';

const Kanban: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: jobsData, isLoading: loading, isError, refetch } = useJobsList({
    enabled: Boolean(user),
  });

  const jobs = jobsData?.items ?? [];
  const dailyLimit = jobsData?.dailyLimit ?? 25;
  const remaining = jobsData?.remaining ?? dailyLimit;
  const atDailyCap = remaining <= 0;
  const kanbanPatch = useKanbanPatchMutation();
  const [fetchInFlight, setFetchInFlight] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);
  const { data: profile } = useProfileQuery({ enabled: Boolean(user) });
  const minMatch = profile?.minMatchPercent ?? 60;

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [listQuery, setListQuery] = useState('');
  const [listStageFilter, setListStageFilter] = useState<'ALL' | JobCard['kanbanColumn']>('ALL');
  const [listSourceFilter, setListSourceFilter] = useState('All Sources');
  const [optimisticJobs, setOptimisticJobs] = useState<JobCard[] | null>(null);
  const [jobToDelete, setJobToDelete] = useState<JobCard | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const patchInFlight = useRef<Set<string>>(new Set());
  const fetchAbortRef = useRef<AbortController | null>(null);
  const pipelineTotal = jobsData?.totalCount ?? jobs.length;

  useEffect(() => () => { fetchAbortRef.current?.abort(); }, []);

  const boardJobs = useMemo(() => {
    const base = optimisticJobs ?? jobs;
    return base.filter(j => (j.matchPercent ?? 0) >= minMatch);
  }, [optimisticJobs, jobs, minMatch]);

  const handleFetchJobs = async () => {
    if (atDailyCap) {
      toast.error(
        `You have reached your daily limit of ${dailyLimit} jobs. Come back tomorrow.`,
      );
      return;
    }
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setFetchInFlight(true);
    setFetchProgress(pipelineTotal === 0 ? 'Starting full job search…' : 'Fetching jobs…');
    try {
      const result = await fetchJobsOrchestrated(5, status => {
        setFetchProgress(status.message ?? 'Matching jobs to your profile…');
      }, controller.signal);
      await qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      await qc.invalidateQueries({ queryKey: queryKeys.onboarding.delivery() });
      if (result.fullSearch) {
        toast.success('Job search complete — your evaluated matches are in the tracker.');
        return;
      }
      const n = result.delivered;
      if (n > 0) {
        toast.success(`Added ${n} job${n === 1 ? '' : 's'} from all sources.`);
        return;
      }
      toast('No new roles for your profile right now. Try broadening target roles or check back later.');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const msg = getUserFacingErrorMessage(e, 'Failed to fetch jobs.');
      toast.error(
        isApiError(e) && (e.status === 429 || e.response?.status === 429)
          ? `You have reached your daily limit of ${dailyLimit} jobs. Come back tomorrow.`
          : msg,
      );
    } finally {
      setFetchInFlight(false);
      setFetchProgress(null);
    }
  };

  const listSourceOptions = useMemo(() => {
    const sources = new Set<string>();
    for (const j of boardJobs) {
      if (j.sourceName) sources.add(sourceLabel(j.sourceName));
    }
    return ['All Sources', ...Array.from(sources).sort((a, b) => a.localeCompare(b))];
  }, [boardJobs]);

  useEffect(() => {
    if (listSourceFilter !== 'All Sources' && !listSourceOptions.includes(listSourceFilter)) {
      setListSourceFilter('All Sources');
    }
  }, [listSourceOptions, listSourceFilter]);

  const listJobs = boardJobs.filter(job => {
    const q = listQuery.trim().toLowerCase();
    const queryMatch = !q ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q);
    const stageMatch =
      listStageFilter === 'ALL'
      || job.kanbanColumn === listStageFilter
      || (listStageFilter === 'Discovered' && job.kanbanColumn === 'Saved');
    const sourceMatch = listSourceFilter === 'All Sources' ||
      sourceLabel(job.sourceName).toLowerCase() === listSourceFilter.toLowerCase();
    return queryMatch && stageMatch && sourceMatch;
  });

  async function handleListStageChange(job: JobCard, nextStage: JobCard['kanbanColumn']) {
    if (patchInFlight.current.has(job.userJobId)) {
      toast.error('This card is still saving. Please wait a moment.');
      return;
    }

    patchInFlight.current.add(job.userJobId);
    setOptimisticJobs(current => {
      const base = (current ?? jobs).filter(j => (j.matchPercent ?? 0) >= minMatch);
      return base.map(item => (
        item.userJobId === job.userJobId ? { ...item, kanbanColumn: nextStage } : item
      ));
    });

    try {
      await kanbanPatch.mutateAsync({
        userJobId: job.userJobId,
        body: { kanbanColumn: nextStage },
      });
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e, 'Failed to move job stage.'));
    } finally {
      patchInFlight.current.delete(job.userJobId);
      if (patchInFlight.current.size === 0) {
        setOptimisticJobs(null);
      }
    }
  }

  async function confirmDeleteJob() {
    if (!jobToDelete) return;
    setDeletePending(true);
    try {
      await jobsApi.delete(jobToDelete.userJobId);
      await qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      setJobToDelete(null);
      toast.success('Job deleted.');
    } catch {
      toast.error('Could not delete job.');
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <PageMeta title="Job Tracker | NewCareers" />
      <div className="bg-background text-on-background flex flex-col flex-1 min-h-0">
        <main className="flex-1 flex flex-col app-shell gap-gutter w-full pt-6 md:pt-8 min-h-0">
          <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">Application Pipeline</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Manage and track your career progression through the funnel.
                {pipelineTotal > 0 && (
                  <span className="block mt-1 text-sm">
                    {pipelineTotal} role{pipelineTotal === 1 ? '' : 's'} at {minMatch}%+ match (your profile setting).
                  </span>
                )}
                {pipelineTotal === 0 && (
                  <span className="block mt-1 text-sm">
                    Showing roles that meet your {minMatch}% minimum match. Fetch jobs to scan all sources.
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-nowrap items-center gap-2 sm:gap-3 w-full lg:w-auto overflow-x-auto pb-0.5">
              <PipelineSkillActions className="shrink-0" />
              <div className="bg-surface-container-low p-1 rounded-lg flex border border-outline-variant shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('board')}
                  className={`px-3 py-1.5 flex items-center gap-2 rounded-md font-label-md text-label-md transition-colors whitespace-nowrap ${
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
                  className={`px-3 py-1.5 flex items-center gap-2 rounded-md font-label-md text-label-md transition-colors whitespace-nowrap ${
                    viewMode === 'list'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">list</span>
                  List
                </button>
              </div>
              <div className="shrink-0">
                {!atDailyCap && (
                  <button
                    type="button"
                    onClick={() => void handleFetchJobs()}
                    disabled={fetchInFlight}
                    className="px-4 py-1.5 flex items-center gap-2 rounded-md font-label-md text-label-md transition-colors bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
                  >
                    {fetchInFlight ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">download</span>
                    )}
                    {fetchInFlight ? 'Matching…' : 'Fetch Jobs'}
                  </button>
                )}
              </div>
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
                  Failed to load jobs.{' '}
                  <button type="button" className="underline font-medium" onClick={() => void refetch()}>
                    Retry
                  </button>
                </div>
              )}
              {fetchInFlight && fetchProgress && (
                <div
                  className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 mb-4"
                  role="status"
                  aria-live="polite"
                >
                  <span className="inline-block h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                  <p className="text-sm text-on-surface">{fetchProgress}</p>
                </div>
              )}
              {!isError && boardJobs.length === 0 && !fetchInFlight && (
                <div className="rounded-xl border border-outline-variant bg-surface-container-low px-6 py-10 text-center">
                  <p className="font-headline-sm text-on-surface mb-2">No jobs in your tracker yet</p>
                  <p className="text-sm text-on-surface-variant mb-4 max-w-md mx-auto">
                    Fetch jobs to search boards, evaluate matches with AI, and fill your tracker.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleFetchJobs()}
                    disabled={fetchInFlight || atDailyCap}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Fetch jobs now
                  </button>
                </div>
              )}
              {viewMode === 'board' && boardJobs.length > 0 && (
                <div className="flex-1 flex flex-col min-h-0">
                  <KanbanBoard
                    jobs={boardJobs}
                    onJobClick={job => navigate(`/jobs/${job.userJobId}`)}
                  />
                </div>
              )}
              {viewMode === 'list' && boardJobs.length > 0 && (
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
                    <select
                      value={listSourceFilter}
                      onChange={e => setListSourceFilter(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-primary min-w-[140px]"
                      aria-label="Filter by job source"
                    >
                      {listSourceOptions.map(src => (
                        <option key={src} value={src}>{src}</option>
                      ))}
                    </select>
                    {/* Min-match filter disabled — backend uses role/location pre-rank only for now */}
                    <span className="text-on-surface-variant font-label-sm text-label-sm">
                      {listJobs.length} result{listJobs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className={`w-full ${LIST_TABLE_MIN_W} table-fixed border-collapse`}>
                      <colgroup>
                        <col className="w-[28%]" />
                        <col className="w-[11%]" />
                        <col className="w-[12%]" />
                        <col className="w-[9%]" />
                        <col className="w-[14%]" />
                        <col className="w-[16%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left font-medium">Role</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Company</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Source</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Match</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Updated</th>
                          <th scope="col" className="px-6 py-3 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listJobs.map(job => (
                          <tr
                            key={job.userJobId}
                            className="border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors"
                          >
                            <td className="px-6 py-4 align-middle">
                              <div className="min-w-0">
                                <p className="font-headline-sm text-[15px] text-on-surface truncate">{job.title}</p>
                                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{job.location}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <p className="font-body-sm text-body-sm text-on-surface truncate">{job.company}</p>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <JobSourceBadge name={job.sourceName ?? null} />
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <span className="inline-block whitespace-nowrap text-primary bg-primary-fixed text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
                                {job.matchPercent ?? 0}% Match
                              </span>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <select
                                value={job.kanbanColumn}
                                onChange={e => handleListStageChange(job, e.target.value as JobCard['kanbanColumn'])}
                                aria-label={`Stage for ${job.title}`}
                                className="w-full max-w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 pr-8 text-xs font-medium text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                              >
                                {LIST_ROW_STAGE_OPTIONS.map(stage => (
                                  <option key={stage} value={stage}>
                                    {columnLabel(stage)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <time
                                dateTime={job.deliveredAt ?? job.postedAt ?? undefined}
                                className="font-label-sm text-label-sm text-on-surface-variant tabular-nums whitespace-nowrap"
                                title={timeAgoLabel(job.deliveredAt ?? job.postedAt)}
                              >
                                {timeAgoLabel(job.deliveredAt ?? job.postedAt)}
                              </time>
                            </td>
                            <td className="px-6 py-4 align-middle">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setJobToDelete(job)}
                                  aria-label={`Delete ${job.title} from pipeline`}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md text-error hover:bg-error/10 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/jobs/${job.userJobId}`)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-primary font-label-sm text-label-sm hover:bg-primary/10 transition-colors whitespace-nowrap"
                                >
                                  Open
                                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
          <div className="w-full py-8 app-shell flex flex-col md:flex-row justify-between items-center gap-4">
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

      <ConfirmModal
        open={jobToDelete != null}
        onClose={() => setJobToDelete(null)}
        onConfirm={confirmDeleteJob}
        loading={deletePending}
        destructive
        title="Delete from pipeline?"
        description={
          jobToDelete ? (
            <>
              Remove <strong className="text-on-surface">{jobToDelete.title}</strong>
              {jobToDelete.company ? <> at {jobToDelete.company}</> : null} from your tracker?
              This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete job"
        cancelLabel="Keep job"
      />
    </>
  );
};

export default Kanban;
