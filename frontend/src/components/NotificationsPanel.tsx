import React, { useEffect, useState } from 'react';
import { notificationsApi, type AppNotification } from '../services/notificationsApi';

interface Props {
  onClose: () => void;
  /** Called after mark-all-read so Navbar can zero the badge instantly */
  onMarkAllRead?: () => void;
}

const NotificationsPanel: React.FC<Props> = ({ onClose, onMarkAllRead }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsApi.getNotifications(0, 20)
      .then(res => setNotifications(res.items))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = () => {
    notificationsApi.markAllRead()
      .then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        onMarkAllRead?.();
      });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div
      className="w-[360px] rounded-2xl overflow-hidden shadow-lg
                 bg-white border border-border"
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-text-primary">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center
                             min-w-[18px] h-[18px] px-1 rounded-full
                             bg-brand-500 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-brand-600 hover:text-brand-700 transition-colors font-medium"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1 rounded hover:bg-surface-overlay transition-colors
                       text-text-tertiary hover:text-text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[360px] overflow-y-auto">
        {loading && (
          <div className="py-10 text-center text-sm text-text-muted">Loading…</div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-3xl mb-2">🔔</div>
            <p className="text-sm text-text-muted">You're all caught up!</p>
          </div>
        )}
        {!loading && notifications.map(n => (
          <div
            key={n.id}
            className={cn(
              'flex gap-3 items-start px-4 py-3 border-b border-border last:border-0 transition-colors',
              n.read ? 'bg-transparent' : 'bg-brand-50',
            )}
          >
            <span className={cn(
              'mt-1.5 w-2 h-2 rounded-full shrink-0',
              n.read ? 'bg-transparent' : 'bg-brand-500',
            )} />
            <div className="min-w-0">
              <p className="text-sm text-text-primary leading-snug">{n.title}</p>
              {n.body && <p className="mt-1 text-xs text-text-muted">{n.body}</p>}
              <p className="mt-0.5 text-xs text-text-tertiary">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default NotificationsPanel;
