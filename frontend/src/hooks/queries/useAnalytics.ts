import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/services/analyticsApi';
import { queryKeys } from '@/lib/queryKeys';

export function useAnalyticsSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.analytics.summary(),
    queryFn: () => analyticsApi.getSummary(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useAnalyticsTimeSeries(weeks = 8, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.analytics.timeSeries(weeks),
    queryFn: () => analyticsApi.getTimeSeries(weeks),
    enabled: options?.enabled ?? true,
    staleTime: 120_000,
  });
}
