/**
 * useFiltersMutation.ts — Batch 5
 *
 * Optimistic profile-save mutation for Account Settings.
 * Maps UpdateProfilePayload onto Profile cache keys (no raw spread).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateProfilePayload } from '@/context/AuthContext';
import { profileApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Profile } from '@/types';
import { payloadAffectsPipelineMatch, profileOptimisticFromPayload } from '@/lib/profileMerge';
import { invalidatePipelineAfterProfileChange } from './useJobs';

/** @deprecated Legacy filter-bar shape — use UpdateProfilePayload via settingsFormToPayload */
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
    mutationFn: (payload: UpdateProfilePayload) => {
      const cached = qc.getQueryData<Profile>(queryKeys.profile.current());
      return profileApi.update(payload, cached?.version);
    },

    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: queryKeys.profile.current() });
      const prev = qc.getQueryData<Profile>(queryKeys.profile.current());
      if (prev) {
        qc.setQueryData<Profile>(
          queryKeys.profile.current(),
          profileOptimisticFromPayload(prev, payload),
        );
      }
      return { prev };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.profile.current(), ctx.prev);
      }
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile.current() });
      }
    },

    onSuccess: (serverProfile, variables) => {
      qc.setQueryData(queryKeys.profile.current(), serverProfile);
      if (payloadAffectsPipelineMatch(variables)) {
        invalidatePipelineAfterProfileChange();
      }
    },

    onSettled: (_data, error) => {
      if (error) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile.current() });
      }
    },
  });
}
