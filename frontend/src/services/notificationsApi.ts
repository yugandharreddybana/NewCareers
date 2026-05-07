/**
 * Section 8 — Task 84
 * Notifications API service.
 */

import { api } from './api';
import type { AppNotification, NotificationType, NotificationsResponse } from '@/types/notification';
export type { AppNotification, NotificationType, NotificationsResponse } from '@/types/notification';

type NotificationDto = {
  id: string;
  type: string;
  subject: string;
  body?: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type NotificationPageDto = {
  content: NotificationDto[];
  totalElements: number;
  number: number;
  size: number;
  totalPages: number;
};

const toAppNotification = (notification: NotificationDto): AppNotification => ({
  id: notification.id,
  type: notification.type as NotificationType,
  title: notification.subject,
  read: notification.read,
  createdAt: notification.createdAt,
  ...(notification.body ? { body: notification.body } : {}),
  ...(notification.metadata ? { metadata: notification.metadata } : {}),
});

// ── API ─────────────────────────────────────────────────────────────────

export const notificationsApi = {
  /**
   * GET /api/notifications?page=0&size=20
   * Returns paginated notifications + unread count.
   */
  getNotifications: async (page = 0, size = 20): Promise<NotificationsResponse> => {
    const [pageResponse, unreadResponse] = await Promise.all([
      api.get<NotificationPageDto>('/notifications', {
        params: { page, size },
      }),
      api.get<{ unread: number }>('/notifications/unread-count'),
    ]);

    return {
      items: pageResponse.data.content.map(toAppNotification),
      total: pageResponse.data.totalElements,
      page: pageResponse.data.number,
      size: pageResponse.data.size,
      totalPages: pageResponse.data.totalPages,
      unreadCount: unreadResponse.data.unread,
    };
  },

  /**
   * PATCH /api/notifications/:id/read
   * Marks a single notification as read.
   */
  markRead: async (id: string): Promise<void> => {
    await api.patch(`/notifications/${id}/read`);
  },

  /**
   * PATCH /api/notifications/read-all
   * Marks ALL notifications as read for the current user.
   */
  markAllRead: async (): Promise<void> => {
    await api.patch('/notifications/mark-all-read');
  },

  /**
   * DELETE /api/notifications
   * Clears all notifications for the current user.
   */
  clearAll: async (): Promise<void> => {
    await api.delete('/notifications');
  },
};
