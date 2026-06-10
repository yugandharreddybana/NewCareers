import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/services/notificationsApi';
import { queryKeys } from '@/lib/queryKeys';

const POLL_MS = 60_000;

export function useNotificationUnreadCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications.unread(),
    queryFn: async () => {
      // #region agent log
      fetch('http://127.0.0.1:7839/ingest/bb7fc4ba-6f0e-4fdc-8dec-2d763bd17bfa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'164405'},body:JSON.stringify({sessionId:'164405',location:'useNotifications.ts:unread',message:'unread count fetch',data:{},timestamp:Date.now(),hypothesisId:'notif-dual',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      return notificationsApi.getUnreadCount();
    },
    enabled: options?.enabled ?? true,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useNotificationsPage(page: number, size = 20, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications.page(page, size),
    queryFn: () => notificationsApi.getNotifications(page, size),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
}
