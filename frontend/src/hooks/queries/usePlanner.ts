import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export const plannerQueryKeys = {
  all: ['planner'] as const,
  tasks: () => [...plannerQueryKeys.all, 'tasks'] as const,
  deadlines: () => [...plannerQueryKeys.all, 'deadlines'] as const,
};

export function usePlannerTasksQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: plannerQueryKeys.tasks(),
    queryFn: () => api.get('/planner/tasks').then(r => r.data),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function usePlannerDeadlinesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: plannerQueryKeys.deadlines(),
    queryFn: () => api.get('/planner/deadlines').then(r => r.data),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useInvalidatePlanner() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: plannerQueryKeys.all });
}
