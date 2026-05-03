/**
 * plannerApi.ts
 *
 * G6/plannerApi fix (Batch 7b): removed the spurious /api/ prefix on every
 * path. The axios instance already has baseURL set to {MIDDLEWARE_URL}/api,
 * so prefixing paths with /api/ caused every planner request to hit
 * {MIDDLEWARE_URL}/api/api/planner/... which resolved to a 404.
 */
import { api as axios } from '../services/api';

export interface DeadlinePayload {
  eventType: string;
  title: string;
  notes?: string;
  eventDate: string;
  remindAt?: string;
}

export const plannerApi = {
  // ── Dashboard summary ──────────────────────────────────────────────────────
  getUpcoming: () => axios.get('/planner/upcoming').then(r => r.data),

  // ── Per-job tasks ────────────────────────────────────────────────────────
  getTasksForJob: (userJobId: string | number) =>
    axios.get(`/planner/jobs/${userJobId}/tasks`).then(r => r.data),

  generateTasks: (userJobId: string | number) =>
    axios.post(`/planner/jobs/${userJobId}/tasks/generate`).then(r => r.data),

  completeTask: (taskId: string | number) =>
    axios.patch(`/planner/tasks/${taskId}/complete`).then(r => r.data),

  // ── Per-job deadlines ───────────────────────────────────────────────────
  getDeadlinesForJob: (userJobId: string | number) =>
    axios.get(`/planner/jobs/${userJobId}/deadlines`).then(r => r.data),

  createDeadline: (userJobId: string | number, payload: DeadlinePayload) =>
    axios.post(`/planner/jobs/${userJobId}/deadlines`, payload).then(r => r.data),
};
