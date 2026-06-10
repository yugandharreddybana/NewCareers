import { describe, expect, it, vi, beforeEach } from 'vitest';

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('./api', () => ({
  api: { get, patch: vi.fn(), delete: vi.fn() },
}));

import { notificationsApi } from './notificationsApi';

describe('notificationsApi', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('getUnreadCount calls only unread-count endpoint', async () => {
    get.mockResolvedValueOnce({ data: { unread: 3 } });
    await expect(notificationsApi.getUnreadCount()).resolves.toBe(3);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('getNotifications calls only notifications list endpoint', async () => {
    get.mockResolvedValueOnce({
      data: {
        content: [{ id: '1', type: 'SYSTEM', subject: 'Hi', read: false, createdAt: '2026-01-01' }],
        totalElements: 1,
        number: 0,
        size: 20,
        totalPages: 1,
      },
    });
    const res = await notificationsApi.getNotifications(0, 20);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/notifications', { params: { page: 0, size: 20 } });
    expect(res.unreadCount).toBe(1);
  });
});
