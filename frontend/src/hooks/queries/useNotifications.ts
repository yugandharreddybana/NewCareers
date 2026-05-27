import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/services/notificationsApi';
import { queryKeys } from '@/lib/queryKeys';

const POLL_MS = 60_000;

export function useNotificationUnreadCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications.unread(),
    queryFn: async () => {
      const res = await notificationsApi.getNotifications(0, 1);
      return res.unreadCount;
    },
    enabled: options?.enabled ?? true,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useNotificationsPage(page: number, size = 20, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications.page(page, size),
    queryFn: () => notificationsApi.getNotifications(page, size),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
}
