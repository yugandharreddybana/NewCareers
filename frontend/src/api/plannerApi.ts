import { api as axios } from '../services/api';

export interface DeadlinePayload {
  eventType: string;
  title: string;
  notes?: string;
  eventDate: string;
  remindAt?: string;
}

export const plannerApi = {
  // ── Dashboard summary ────────────────────────────────────────────────────────
  getUpcoming: () => axios.get('/api/planner/upcoming').then(r => r.data),

  // ── Per-job tasks ─────────────────────────────────────────────────────────────
  getTasksForJob: (userJobId: string | number) =>
    axios.get(`/api/planner/jobs/${userJobId}/tasks`).then(r => r.data),

  generateTasks: (userJobId: string | number) =>
    axios.post(`/api/planner/jobs/${userJobId}/tasks/generate`).then(r => r.data),

  completeTask: (taskId: string | number) =>
    axios.patch(`/api/planner/tasks/${taskId}/complete`).then(r => r.data),

  // ── Per-job deadlines ─────────────────────────────────────────────────────────
  getDeadlinesForJob: (userJobId: string | number) =>
    axios.get(`/api/planner/jobs/${userJobId}/deadlines`).then(r => r.data),

  createDeadline: (userJobId: string | number, payload: DeadlinePayload) =>
    axios.post(`/api/planner/jobs/${userJobId}/deadlines`, payload).then(r => r.data)
};
