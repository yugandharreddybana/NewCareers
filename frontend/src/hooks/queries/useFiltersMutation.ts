/**
 * useFiltersMutation.ts — Batch 5
 *
 * Optimistic filter-save mutation.
 *
 * Why this exists:
 *   Saving search filters (location, employment type, salary range) previously
 *   waited for the backend round-trip before the UI reflected the change.
 *   This felt sluggish because the filter bar would briefly reset or flicker.
 *
 * How it works:
 *   1. onMutate immediately writes the new filters into the profile query
 *      cache so the UI reflects the change with zero latency.
 *   2. The API call proceeds in the background.
 *   3. onError reverts the cache to the previous snapshot.
 *   4. onSettled invalidates the profile query so the next read is fresh.
 *
 * The backend endpoint is PATCH /profile with the filter fields included.
 * Adjust `filterFields` below if the API shape changes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Profile } from '@/types';

export type FilterPayload = {
  targetLocations?: string[];
  employmentTypes?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  remoteOnly?: boolean;
  targetRoles?: string[];
};

export function useFiltersMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (filters: FilterPayload) => profileApi.update(filters),

    // 1 – Optimistic: write new filters into profile cache immediately
    onMutate: async (filters) => {
      await qc.cancelQueries({ queryKey: queryKeys.profile.current() });
      const prev = qc.getQueryData<Profile>(queryKeys.profile.current());
      if (prev) {
        qc.setQueryData<Profile>(queryKeys.profile.current(), {
          ...prev,
          ...filters,
        } as Profile);
      }
      return { prev };
    },

    // 2 – Revert on failure
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.profile.current(), ctx.prev);
      }
    },

    // 3 – Sync truth from server
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profile.current() });
    },
  });
}
