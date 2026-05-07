import { useState, useEffect, useCallback } from 'react';
import { plannerApi, type DeadlinePayload } from '@/services/plannerApi';
import type {
  PlannerDeadline,
  PlannerDashboardTask,
  PlannerUpcomingSummary,
} from '@/types/planner';
import toast from 'react-hot-toast';

const EMPTY_UPCOMING: PlannerUpcomingSummary = {
  pendingTasks: [],
  upcomingEvents: [],
  overdueTasks: [],
};

const getPlannerErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/**
 * Fetches upcoming tasks + deadlines for the logged-in user.
 * Re-fetches whenever `refreshKey` changes.
 */
export function useUpcoming(refreshKey = 0) {
  const [data, setData] = useState<PlannerUpcomingSummary>(EMPTY_UPCOMING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    plannerApi.getUpcoming()
      .then(res => setData(res ?? EMPTY_UPCOMING))
      .catch((error: unknown) => {
        const msg = getPlannerErrorMessage(error, 'Failed to load planner');
        setError(msg);
        toast.error(msg);
        setData(EMPTY_UPCOMING);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return { data, loading, error };
}

/**
 * Manages tasks for a single tracked job.
 */
export function useJobTasks(userJobId: string | number) {
  const [tasks, setTasks] = useState<PlannerDashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    if (!userJobId) return;
    setLoading(true);
    plannerApi.getTasksForJob(userJobId)
      .then(res => setTasks(res))
      .catch((error: unknown) => setError(getPlannerErrorMessage(error, 'Failed to load tasks')))
      .finally(() => setLoading(false));
  }, [userJobId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const generate = useCallback(async () => {
    await plannerApi.generateTasks(userJobId);
    fetchTasks();
  }, [userJobId, fetchTasks]);

  const complete = useCallback(async (taskId: string | number) => {
    await plannerApi.completeTask(taskId);
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, generate, complete, refresh: fetchTasks };
}

/**
 * Manages deadlines for a single tracked job.
 */
export function useJobDeadlines(userJobId: string | number) {
  const [deadlines, setDeadlines] = useState<PlannerDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeadlines = useCallback(() => {
    if (!userJobId) return;
    setLoading(true);
    plannerApi.getDeadlinesForJob(userJobId)
      .then(res => setDeadlines(res))
      .catch((error: unknown) => setError(getPlannerErrorMessage(error, 'Failed to load deadlines')))
      .finally(() => setLoading(false));
  }, [userJobId]);

  useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);

  const addDeadline = useCallback(async (payload: DeadlinePayload) => {
    await plannerApi.createDeadline(userJobId, payload);
    fetchDeadlines();
  }, [userJobId, fetchDeadlines]);

  return { deadlines, loading, error, addDeadline, refresh: fetchDeadlines };
}
