import { api as axios } from '../services/api';

// ── Dashboard summary ────────────────────────────────────────────────────────
export const getUpcoming = () =>
  axios.get('/api/planner/upcoming');

// ── Per-job tasks ─────────────────────────────────────────────────────────────
export const getTasksForJob = (userJobId) =>
  axios.get(`/api/planner/jobs/${userJobId}/tasks`);

export const generateTasks = (userJobId) =>
  axios.post(`/api/planner/jobs/${userJobId}/tasks/generate`);

export const completeTask = (taskId) =>
  axios.patch(`/api/planner/tasks/${taskId}/complete`);

// ── Per-job deadlines ─────────────────────────────────────────────────────────
export const getDeadlinesForJob = (userJobId) =>
  axios.get(`/api/planner/jobs/${userJobId}/deadlines`);

export const createDeadline = (userJobId, payload) =>
  axios.post(`/api/planner/jobs/${userJobId}/deadlines`, payload);
// payload: { eventType, title, notes, eventDate, remindAt }
