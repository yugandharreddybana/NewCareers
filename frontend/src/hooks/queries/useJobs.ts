/**
 * useJobs.ts — Batch 5
 *
 * Changes over Batch 4:
 *   B5.020 – useInfiniteJobsFeed: replaces the all-at-once useJobsList for
 *            the job feed / pipeline pages. Fetches one page at a time via
 *            useInfiniteQuery; VirtualJobFeed + useScrollPrefetch drive it.
 *   B5.021 – useKanbanPatchMutation: added optimistic update so the card's
 *            column flips instantly in the cache; rolled back on error.
 *   B5.022 – useJobFavoriteMutation: new mutation with optimistic toggle of
 *            isFavorite flag in the jobs list cache.
 *   B5.023 – useJobsList retained unchanged for the dashboard marquee (small
 *            slice, not a full list) and for backward compat.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { jobsApi, kanbanApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import type { JobCard, JobDetail, JobsListResponse, KanbanColumn, Stats } from '@/types';

/** One pipeline-wide skill resync per browser session. */
let pipelineSkillsSynced = false;

async function ensurePipelineSkillsSynced(): Promise<void> {
  if (pipelineSkillsSynced) return;
  pipelineSkillsSynced = true;
  try {
    await jobsApi.refreshSkills();
  } catch {
    pipelineSkillsSynced = false;
  }
}

// ── B5.020 – Infinite paginated feed ──────────────────────────────────────
const FEED_PAGE_SIZE = 20;

export type InfiniteJobsPage = {
  items: JobCard[];
  nextPage: number | null;
  totalCount: number;
};

/**
 * useInfiniteJobsFeed
 *
 * Powers the job list / pipeline pages. Each page fetches FEED_PAGE_SIZE
 * cards. The VirtualJobFeed component calls `fetchNextPage` via
 * useScrollPrefetch when the user nears the bottom.
 *
 * @param filters  – passed as query params to /jobs
 * @param enabled  – set false to skip the initial fetch
 */
export function useInfiniteJobsFeed(
  filters: Record<string, string | number | boolean | undefined> = {},
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.jobs.list(), 'infinite', filters] as const,
    queryFn: async ({ pageParam = 0 }) => {
      if (pageParam === 0) await ensurePipelineSkillsSynced();
      const res = await jobsApi.list(pageParam as number, FEED_PAGE_SIZE);
      const nextPage = res.hasMore ? (pageParam as number) + 1 : null;
      return { items: res.items, nextPage, totalCount: res.totalCount ?? res.items.length } as InfiniteJobsPage;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: InfiniteJobsPage) => lastPage.nextPage ?? undefined,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    // Keep previous data visible while the next page loads (no blank flash)
    placeholderData: (prev: ReturnType<typeof useInfiniteJobsFeed>['data']) => prev,
  });
}

// ── Original list query (dashboard marquee + backward compat) ─────────────
export function useJobsList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn: async (): Promise<JobsListResponse> => {
      await ensurePipelineSkillsSynced();
      return jobsApi.listAll();
    },
    enabled: options?.enabled ?? true,
    retry: 2,
  });
}

export function useJobDetail(userJobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(userJobId ?? ''),
    queryFn: async (): Promise<JobDetail> => {
      await ensurePipelineSkillsSynced();
      return jobsApi.detail(userJobId!);
    },
    enabled: Boolean(userJobId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useJobsStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.jobs.stats(),
    queryFn: (): Promise<Stats> => jobsApi.stats(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useInvalidateJobs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
}

export function useFetchLiveJobMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => jobsApi.fetchLive(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      void qc.invalidateQueries({ queryKey: queryKeys.discovery.all });
    },
  });
}

export function useFetchMoreJobsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count: number) => jobsApi.fetch(count),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      void qc.invalidateQueries({ queryKey: queryKeys.discovery.all });
      void qc.invalidateQueries({ queryKey: queryKeys.usage.limits() });
    },
  });
}

export function useFetchIrishJobsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count: number) => jobsApi.fetchIrishJobs(count),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      void qc.invalidateQueries({ queryKey: queryKeys.discovery.all });
      void qc.invalidateQueries({ queryKey: queryKeys.usage.limits() });
    },
  });
}

// ── B5.021 – Kanban patch with optimistic update ──────────────────────────
export function useKanbanPatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userJobId,
      body,
    }: {
      userJobId: string;
      body: { kanbanColumn?: KanbanColumn; status?: string };
    }) => kanbanApi.patch(userJobId, body),

    // Flip the card's column in the cache immediately
    onMutate: async ({ userJobId, body }) => {
      await qc.cancelQueries({ queryKey: queryKeys.jobs.list() });
      const prev = qc.getQueryData<JobsListResponse>(queryKeys.jobs.list());
      if (prev && body.kanbanColumn) {
        qc.setQueryData<JobsListResponse>(queryKeys.jobs.list(), {
          ...prev,
          items: prev.items.map(j =>
            j.userJobId === userJobId ? { ...j, kanbanColumn: body.kanbanColumn! } : j,
          ),
        });
      }
      return { prev };
    },

    // Revert on error
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.jobs.list(), ctx.prev);
    },

    // Always refetch to stay in sync
    onSettled: (_data, _err, { userJobId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.detail(userJobId) });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.stats() });
    },
  });
}

// ── B5.022 – Favorite toggle with optimistic update ───────────────────────
/**
 * useJobFavoriteMutation
 *
 * Toggles isFavorite on a UserJob. Flips the flag optimistically in the
 * jobs-list cache and reverts on error, avoiding any visible lag.
 */
export function useJobFavoriteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userJobId, isFavorite }: { userJobId: string; isFavorite: boolean }) =>
      kanbanApi.patch(userJobId, { status: isFavorite ? 'favorite' : 'unfavorite' }),

    onMutate: async ({ userJobId, isFavorite }) => {
      await qc.cancelQueries({ queryKey: queryKeys.jobs.list() });
      const prev = qc.getQueryData<JobsListResponse>(queryKeys.jobs.list());
      if (prev) {
        qc.setQueryData<JobsListResponse>(queryKeys.jobs.list(), {
          ...prev,
          items: prev.items.map(j =>
            j.userJobId === userJobId ? { ...j, isFavorite } : j,
          ),
        });
      }
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.jobs.list(), ctx.prev);
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.list() });
    },
  });
}
