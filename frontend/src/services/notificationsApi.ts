/**
 * Section 8 — Task 84
 * Notifications API service.
 */

import { api } from './api';

// ── Types ───────────────────────────────────────────────────────────────

export type NotificationType =
  | 'SKILL_COMPLETE'
  | 'INTERVIEW_REMINDER'
  | 'JOB_MATCH'
  | 'WEEKLY_DIGEST'
  | 'SYSTEM';

export interface AppNotification {
  id:          string;
  type:        NotificationType;
  title:       string;
  body?:       string;
  read:        boolean;
  metadata?:   Record<string, unknown>;
  createdAt:   string;
}

export interface NotificationsResponse {
  items:       AppNotification[];
  total:       number;
  page:        number;
  size:        number;
  totalPages:  number;
  unreadCount: number;
}

// ── API ─────────────────────────────────────────────────────────────────

export const notificationsApi = {
  /**
   * GET /api/notifications?page=0&size=20
   * Returns paginated notifications + unread count.
   */
  getNotifications: async (page = 0, size = 20): Promise<NotificationsResponse> => {
    const res = await api.get<NotificationsResponse>('/api/notifications', {
      params: { page, size },
    });
    return res.data;
  },

  /**
   * PATCH /api/notifications/:id/read
   * Marks a single notification as read.
   */
  markRead: async (id: string): Promise<void> => {
    await api.patch(`/api/notifications/${id}/read`);
  },

  /**
   * PATCH /api/notifications/read-all
   * Marks ALL notifications as read for the current user.
   */
  markAllRead: async (): Promise<void> => {
    await api.patch('/api/notifications/read-all');
  },

  /**
   * DELETE /api/notifications
   * Clears all notifications for the current user.
   */
  clearAll: async (): Promise<void> => {
    await api.delete('/api/notifications');
  },
};
