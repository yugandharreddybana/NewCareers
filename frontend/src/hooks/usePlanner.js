import { useState, useEffect, useCallback } from 'react';
import * as plannerApi from '../api/planner';

/**
 * Fetches upcoming tasks + deadlines for the logged-in user.
 * Re-fetches whenever `refreshKey` changes.
 */
export function useUpcoming(refreshKey = 0) {
  const [data, setData]     = useState({ pendingTasks: [], upcomingEvents: [], overdueTasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    plannerApi.getUpcoming()
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load planner'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return { data, loading, error };
}

/**
 * Manages tasks for a single tracked job.
 */
export function useJobTasks(userJobId) {
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetchTasks = useCallback(() => {
    if (!userJobId) return;
    setLoading(true);
    plannerApi.getTasksForJob(userJobId)
      .then(res => setTasks(res.data))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load tasks'))
      .finally(() => setLoading(false));
  }, [userJobId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const generate = useCallback(async () => {
    await plannerApi.generateTasks(userJobId);
    fetchTasks();
  }, [userJobId, fetchTasks]);

  const complete = useCallback(async (taskId) => {
    await plannerApi.completeTask(taskId);
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, generate, complete, refresh: fetchTasks };
}

/**
 * Manages deadlines for a single tracked job.
 */
export function useJobDeadlines(userJobId) {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const fetchDeadlines = useCallback(() => {
    if (!userJobId) return;
    setLoading(true);
    plannerApi.getDeadlinesForJob(userJobId)
      .then(res => setDeadlines(res.data))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load deadlines'))
      .finally(() => setLoading(false));
  }, [userJobId]);

  useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);

  const addDeadline = useCallback(async (payload) => {
    await plannerApi.createDeadline(userJobId, payload);
    fetchDeadlines();
  }, [userJobId, fetchDeadlines]);

  return { deadlines, loading, error, addDeadline, refresh: fetchDeadlines };
}
