import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsApi, kanbanApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import type { JobDetail, JobsListResponse, KanbanColumn, Stats } from '@/types';

export function useJobsList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn: (): Promise<JobsListResponse> => jobsApi.list(),
    enabled: options?.enabled ?? true,
  });
}

export function useJobDetail(userJobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(userJobId ?? ''),
    queryFn: (): Promise<JobDetail> => jobsApi.detail(userJobId!),
    enabled: Boolean(userJobId),
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
    },
  });
}

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
    onSuccess: (_data, { userJobId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.detail(userJobId) });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.stats() });
    },
  });
}
