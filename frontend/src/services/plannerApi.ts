import { api } from './api';
import type {
  PlannerDeadline,
  PlannerDashboardTask,
  PlannerUpcomingSummary,
  PlannerDeadlineEventType,
} from '@/types/planner';

export interface DeadlinePayload {
  eventType: PlannerDeadlineEventType;
  title: string;
  notes?: string;
  eventDate: string;
  remindAt?: string;
}

export const plannerApi = {
  getUpcoming: (): Promise<PlannerUpcomingSummary> =>
    api.get<PlannerUpcomingSummary>('/planner/upcoming').then(r => r.data),

  getTasksForJob: (userJobId: string | number): Promise<PlannerDashboardTask[]> =>
    api.get<PlannerDashboardTask[]>(`/planner/jobs/${userJobId}/tasks`).then(r => r.data),

  generateTasks: (userJobId: string | number): Promise<unknown> =>
    api.post(`/planner/jobs/${userJobId}/tasks/generate`).then(r => r.data),

  completeTask: (taskId: string | number): Promise<unknown> =>
    api.patch(`/planner/tasks/${taskId}/complete`).then(r => r.data),

  getDeadlinesForJob: (userJobId: string | number): Promise<PlannerDeadline[]> =>
    api.get<PlannerDeadline[]>(`/planner/jobs/${userJobId}/deadlines`).then(r => r.data),

  createDeadline: (userJobId: string | number, payload: DeadlinePayload): Promise<PlannerDeadline> =>
    api.post<PlannerDeadline>(`/planner/jobs/${userJobId}/deadlines`, payload).then(r => r.data),
};
