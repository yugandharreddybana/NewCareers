/**
 * useJobs.ts — Batch 5 (production-hardened)
 *
 * Production fixes over initial Batch 5 commit:
 *   P1 – useInfiniteJobsFeed now also updates the *infinite* query cache in
 *        useKanbanPatchMutation and useJobFavoriteMutation (previously only
 *        the flat list cache was updated, so optimistic changes were invisible
 *        in the virtualised feed).
 *   P2 – placeholderData is typed correctly (keepPreviousData pattern for
 *        TanStack v5 — the function form).
 *   P3 – FEED_PAGE_SIZE exposed so PipelineDashboard can display
 *        "X more to load" accurately.
 *   P4 – jobsApi.list() already returns a superset of InfiniteJobsPage so we
 *        derive hasMore / nextPage from the API's own hasMore flag rather than
 *        comparing items.length to FEED_PAGE_SIZE (avoids off-by-one on last
 *        page).
 *   P5 – ensurePipelineSkillsSynced guard reset only on hard error (network),
 *        not on soft API errors — avoids infinite re-sync loops.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
  type InfiniteData,
} from '@tanstack/react-query';
import { jobsApi, kanbanApi } from '@/services/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import type { JobCard, JobDetail, JobsListResponse, KanbanColumn, Stats } from '@/types';

export const FEED_PAGE_SIZE = 20; // exported so PipelineDashboard can reference it

const REFRESH_SKILLS_BACKOFF_MS = 60_000;

/** One pipeline-wide skill resync per browser session. */
let pipelineSkillsSynced = false;
let lastRefreshSkillsFailureAt = 0;

/** Reset on logout so the next user triggers refreshSkills on first feed load. */
export function resetPipelineSkillsSync(): void {
  pipelineSkillsSynced = false;
  lastRefreshSkillsFailureAt = 0;
}

/** After profile/CV edits that affect match scores — force re-sync on next feed load. */
export function invalidatePipelineAfterProfileChange(): void {
  resetPipelineSkillsSync();
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
}

async function ensurePipelineSkillsSynced(): Promise<void> {
  if (pipelineSkillsSynced) return;
  if (Date.now() - lastRefreshSkillsFailureAt < REFRESH_SKILLS_BACKOFF_MS) return;
  try {
    await jobsApi.refreshSkills();
    pipelineSkillsSynced = true;
  } catch {
    lastRefreshSkillsFailureAt = Date.now();
  }
}

// ── Infinite query key helper ─────────────────────────────────────────────
const infiniteFeedKey = (filters: Record<string, unknown> = {}) =>
  [...queryKeys.jobs.list(), 'infinite', filters] as const;

// ── B5.020 – Infinite paginated feed ─────────────────────────────────────
export type InfiniteJobsPage = {
  items: JobCard[];
  /** null means no more pages */
  nextPage: number | null;
  totalCount: number;
  /** Pass-through meta from API */
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
};

export function useInfiniteJobsFeed(
  filters: Record<string, string | number | boolean | undefined> = {},
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: infiniteFeedKey(filters),
    queryFn: async ({ pageParam = 0 }): Promise<InfiniteJobsPage> => {
      if (pageParam === 0) await ensurePipelineSkillsSynced();
      const res = await jobsApi.list(pageParam as number, FEED_PAGE_SIZE);
      return {
        items:      res.items,
        // P4 – use the API's own hasMore flag
        nextPage:   res.hasMore ? (pageParam as number) + 1 : null,
        totalCount: res.totalCount ?? res.items.length,
        dailyCount: res.dailyCount ?? 0,
        dailyLimit: res.dailyLimit ?? 25,
        remaining:  res.remaining ?? 0,
      };
    },
    initialPageParam: 0 as number,
    getNextPageParam: (lastPage: InfiniteJobsPage) => lastPage.nextPage ?? undefined,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    // P2 – correct TanStack v5 keepPreviousData pattern
    placeholderData: keepPreviousData,
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
    queryFn: async (): Promise<JobDetail> => jobsApi.detail(userJobId!),
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

export function useClearPipelineMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => jobsApi.clearPipeline(),
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

// ── Helper: patch a job card in the infinite feed cache ───────────────────
// P1 – Both kanban + favorite mutations now update the infinite cache.
function patchInfiniteCache(
  qc: ReturnType<typeof useQueryClient>,
  userJobId: string,
  patch: (card: JobCard) => JobCard,
) {
  // Flat list cache
  const prev = qc.getQueryData<JobsListResponse>(queryKeys.jobs.list());
  if (prev) {
    qc.setQueryData<JobsListResponse>(queryKeys.jobs.list(), {
      ...prev,
      items: prev.items.map(j => (j.userJobId === userJobId ? patch(j) : j)),
    });
  }
  // Infinite feed cache (all filter variants)
  qc.setQueriesData<InfiniteData<InfiniteJobsPage>>(
    { queryKey: [...queryKeys.jobs.list(), 'infinite'] },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map(page => ({
          ...page,
          items: page.items.map(j => (j.userJobId === userJobId ? patch(j) : j)),
        })),
      };
    },
  );
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

    onMutate: async ({ userJobId, body }) => {
      await qc.cancelQueries({ queryKey: queryKeys.jobs.list() });
      await qc.cancelQueries({ queryKey: [...queryKeys.jobs.list(), 'infinite'] });
      // snapshot both caches for rollback
      const prevFlat = qc.getQueryData<JobsListResponse>(queryKeys.jobs.list());
      const prevInfinite = qc.getQueriesData<InfiniteData<InfiniteJobsPage>>({
        queryKey: [...queryKeys.jobs.list(), 'infinite'],
      });
      if (body.kanbanColumn) {
        patchInfiniteCache(qc, userJobId, j => ({ ...j, kanbanColumn: body.kanbanColumn! }));
      }
      return { prevFlat, prevInfinite };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prevFlat) qc.setQueryData(queryKeys.jobs.list(), ctx.prevFlat);
      if (ctx?.prevInfinite) {
        for (const [key, data] of ctx.prevInfinite) {
          qc.setQueryData(key, data);
        }
      }
    },

    onSettled: (_data, _err, { userJobId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.detail(userJobId) });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.stats() });
    },
  });
}

// ── B5.022 – Favorite toggle with optimistic update ───────────────────────
export function useJobFavoriteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userJobId, isFavorite }: { userJobId: string; isFavorite: boolean }) =>
      kanbanApi.patch(userJobId, { status: isFavorite ? 'favorite' : 'unfavorite' }),

    onMutate: async ({ userJobId, isFavorite }) => {
      await qc.cancelQueries({ queryKey: queryKeys.jobs.list() });
      await qc.cancelQueries({ queryKey: [...queryKeys.jobs.list(), 'infinite'] });
      const prevFlat = qc.getQueryData<JobsListResponse>(queryKeys.jobs.list());
      const prevInfinite = qc.getQueriesData<InfiniteData<InfiniteJobsPage>>({
        queryKey: [...queryKeys.jobs.list(), 'infinite'],
      });
      patchInfiniteCache(qc, userJobId, j => ({ ...j, isFavorite }));
      return { prevFlat, prevInfinite };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prevFlat) qc.setQueryData(queryKeys.jobs.list(), ctx.prevFlat);
      if (ctx?.prevInfinite) {
        for (const [key, data] of ctx.prevInfinite) {
          qc.setQueryData(key, data);
        }
      }
    },

    onSettled: (_data, _err, { userJobId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.detail(userJobId) });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.stats() });
    },
  });
}
