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
