import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export const networkingQueryKeys = {
  all: ['networking'] as const,
  contacts: () => [...networkingQueryKeys.all, 'contacts'] as const,
};

export function useNetworkingContactsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: networkingQueryKeys.contacts(),
    queryFn: () => api.get('/networking/contacts').then(r => r.data),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useInvalidateNetworking() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: networkingQueryKeys.contacts() });
}
