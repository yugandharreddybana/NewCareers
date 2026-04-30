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

import { useEffect, useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationsApi } from '@/services/notificationsApi';
import NotificationDrawer from './NotificationDrawer';
import { Button } from '@/components/ui';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications(0, 1);
      setUnreadCount(res.unreadCount);
    } catch { /* silent — badge just stays at last known count */ }
  }, []);

  // Initial fetch + 60s polling
  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchCount]);

  // Re-fetch count when drawer closes (user may have read things)
  function handleDrawerClose() {
    setDrawerOpen(false);
    fetchCount();
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
        onCountChange={setUnreadCount}
      />
    </>
  );
}
