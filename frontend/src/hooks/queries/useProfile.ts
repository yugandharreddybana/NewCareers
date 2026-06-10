import { useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';

const PROFILE_STALE_MS = 60_000;

export function useProfileQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: () => profileApi.get(),
    enabled: options?.enabled ?? true,
    staleTime: PROFILE_STALE_MS,
  });
}

export function useInvalidateProfile() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.profile.current() });
}
