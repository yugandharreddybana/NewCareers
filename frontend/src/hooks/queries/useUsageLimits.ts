import { useQuery } from '@tanstack/react-query';

import { isCompleteUsageLimits } from '@/lib/usageLimitsUtils';
import { queryKeys } from '@/lib/queryKeys';
import { usageApi } from '@/services/api';

export function useUsageLimits() {
  return useQuery({
    queryKey: queryKeys.usage.limits(),
    queryFn: async () => {
      const data = await usageApi.limits();
      if (!isCompleteUsageLimits(data)) {
        throw new Error('Usage limits response is missing required quota fields');
      }
      return data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
