import { useQuery } from '@tanstack/react-query';
import { discoveryApi, type SearchParams } from '@/services/discoveryApi';
import { queryKeys } from '@/lib/queryKeys';

export function useRecommendedJobs(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.discovery.recommended(),
    queryFn: () => discoveryApi.getRecommended(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

/** Server-side pipeline search — only runs when explicitly enabled (submit / pagination). */
export function useJobSearch(params: SearchParams, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.discovery.search(params),
    queryFn: () => discoveryApi.search(params),
    enabled,
    staleTime: 30_000,
  });
}
