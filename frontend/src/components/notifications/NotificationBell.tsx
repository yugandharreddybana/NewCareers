/**
 * Section 8 — Task 85
 * NotificationBell
 *
 * Bell icon button with absolute-positioned unread count badge.
 * - Polls /api/notifications every 60 seconds for unread count.
 * - Shows badge when unreadCount > 0 (max display: 99+).
 * - Click opens the NotificationDrawer.
 * - Badge animates in/out with Framer Motion scale.
 */

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationUnreadCount, useInvalidateNotifications } from '@/hooks/queries';
import NotificationDrawer from './NotificationDrawer';
import { Button } from '@/components/ui';

export default function NotificationBell() {
  const invalidateNotifications = useInvalidateNotifications();
  const { data: unreadCount = 0, refetch } = useNotificationUnreadCount();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refetch();
      }
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [refetch]);

  function handleDrawerClose() {
    setDrawerOpen(false);
    void invalidateNotifications();
  }

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDrawerOpen(true)}
        className="relative text-text-tertiary hover:text-text-primary"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      >
        <Bell size={17} />

        {/* Unread badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                         bg-rose-500 text-white text-[9px] font-black rounded-full
                         flex items-center justify-center leading-none pointer-events-none"
            >
              {badgeLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>

      <NotificationDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        onCountChange={() => void invalidateNotifications()}
      />
    </>
  );
}
