import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

/**
 * Shared React Query client — imported by main.tsx and mutation hooks for invalidation.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (isAxiosError(error) && !error.response) return false;
        const status = (error as { response?: { status?: number } }).response?.status;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
