/**
 * notification.ts — shared notification domain types
 *
 * D4 fix: these types were defined locally inside notificationsApi.ts.
 * Moving them here makes them importable by any page or component
 * without importing the full API service.
 */

export type NotificationType =
  | 'SKILL_COMPLETE'
  | 'INTERVIEW_REMINDER'
  | 'JOB_MATCH'
  | 'WEEKLY_DIGEST'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationsResponse {
  items: AppNotification[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  unreadCount: number;
}
