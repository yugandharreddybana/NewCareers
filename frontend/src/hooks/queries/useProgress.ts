import { useQuery } from '@tanstack/react-query';
import { progressApi } from '@/services/progressApi';
import { queryKeys } from '@/lib/queryKeys';

export function useWeeklyProgress(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.progress.weekly(),
    queryFn: () => progressApi.getWeeklySummary(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useProgressStreaks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.progress.streaks(),
    queryFn: () => progressApi.getStreaks(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}
