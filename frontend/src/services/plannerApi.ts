/**
 * plannerApi.ts — typed client for /planner.
 *
 * Pass 6 #6.011 — moved from src/api/. No previous services/ counterpart;
 * this is the single source of truth.
 */
import { api } from './api';
import type {
  PlannerDeadline,
  PlannerDashboardTask,
  PlannerUpcomingSummary,
} from '@/types/planner';

export interface DeadlinePayload {
  eventType: string;
  title: string;
  notes?: string;
  eventDate: string;
  remindAt?: string;
}

export const plannerApi = {
  // ── Dashboard summary ──────────────────────────────────────────────────────
  getUpcoming: () => api.get<PlannerUpcomingSummary>('/planner/upcoming').then(r => r.data),

  // ── Per-job tasks ────────────────────────────────────────────────────────
  getTasksForJob: (userJobId: string | number) =>
    api.get<PlannerDashboardTask[]>(`/planner/jobs/${userJobId}/tasks`).then(r => r.data),

  generateTasks: (userJobId: string | number) =>
    api.post(`/planner/jobs/${userJobId}/tasks/generate`).then(r => r.data),

  completeTask: (taskId: string | number) =>
    api.patch(`/planner/tasks/${taskId}/complete`).then(r => r.data),

  // ── Per-job deadlines ───────────────────────────────────────────────────
  getDeadlinesForJob: (userJobId: string | number) =>
    api.get<PlannerDeadline[]>(`/planner/jobs/${userJobId}/deadlines`).then(r => r.data),

  createDeadline: (userJobId: string | number, payload: DeadlinePayload) =>
    api.post<PlannerDeadline>(`/planner/jobs/${userJobId}/deadlines`, payload).then(r => r.data),
};
