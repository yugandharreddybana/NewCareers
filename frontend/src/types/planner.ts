/**
 * planner.ts — shared planner domain types
 *
 * D4 fix: planner had no shared type contracts.
 * Any page importing planner data now gets full TS coverage.
 */

export type PlannerTaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type PlannerTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface PlannerTask {
  id: string;
  title: string;
  description?: string;
  status: PlannerTaskStatus;
  priority: PlannerTaskPriority;
  dueDate?: string | null;
  completedAt?: string | null;
  userJobId?: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlannerWeekSummary {
  weekStart: string;
  total: number;
  completed: number;
  overdue: number;
  completionRate: number;
}

export interface PlannerStats {
  thisWeek: PlannerWeekSummary;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  streak: number;
}

export type PlannerDashboardTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
export type PlannerDashboardTaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type PlannerDeadlineEventType =
  | 'APPLICATION_CLOSE'
  | 'INTERVIEW_DATE'
  | 'FOLLOW_UP'
  | 'OFFER_DEADLINE'
  | 'CUSTOM';

export interface PlannerDashboardTask {
  id: string;
  title: string;
  status: PlannerDashboardTaskStatus;
  priority: PlannerDashboardTaskPriority;
  dueDate?: string | null;
  userJobId?: string | null;
}

export interface PlannerDeadline {
  id: string;
  title: string;
  eventType: PlannerDeadlineEventType;
  eventDate: string;
  userJobId?: string | null;
}

export interface PlannerUpcomingSummary {
  pendingTasks: PlannerDashboardTask[];
  upcomingEvents: PlannerDeadline[];
  overdueTasks: PlannerDashboardTask[];
}
