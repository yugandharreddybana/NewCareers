import { useState, useEffect, useCallback } from 'react';
import { plannerApi, DeadlinePayload } from '../api/plannerApi';
import toast from 'react-hot-toast';

/**
 * Fetches upcoming tasks + deadlines for the logged-in user.
 * Re-fetches whenever `refreshKey` changes.
 */
export function useUpcoming(refreshKey = 0) {
  const [data, setData] = useState<any>({ pendingTasks: [], upcomingEvents: [], overdueTasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    plannerApi.getUpcoming()
      .then(res => setData(res || { pendingTasks: [], upcomingEvents: [], overdueTasks: [] }))
      .catch(err => {
        const msg = err?.response?.data?.message || 'Failed to load planner';
        setError(msg);
        toast.error(msg);
        setData({ pendingTasks: [], upcomingEvents: [], overdueTasks: [] });
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return { data, loading, error };
}

/**
 * Manages tasks for a single tracked job.
 */
export function useJobTasks(userJobId: string | number) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    if (!userJobId) return;
    setLoading(true);
    plannerApi.getTasksForJob(userJobId)
      .then(res => setTasks(res))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load tasks'))
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
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeadlines = useCallback(() => {
    if (!userJobId) return;
    setLoading(true);
    plannerApi.getDeadlinesForJob(userJobId)
      .then(res => setDeadlines(res))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load deadlines'))
      .finally(() => setLoading(false));
  }, [userJobId]);

  useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);

  const addDeadline = useCallback(async (payload: DeadlinePayload) => {
    await plannerApi.createDeadline(userJobId, payload);
    fetchDeadlines();
  }, [userJobId, fetchDeadlines]);

  return { deadlines, loading, error, addDeadline, refresh: fetchDeadlines };
}
