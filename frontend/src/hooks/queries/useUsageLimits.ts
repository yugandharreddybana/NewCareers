import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { usageApi } from '@/services/api';

export function useUsageLimits() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.usage.limits(),
    queryFn: () => usageApi.limits(),
    enabled: Boolean(user),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
