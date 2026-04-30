/**
 * Section 8 — Task 86
 * NotificationDrawer
 *
 * Right-side slide-over drawer showing the full notification list.
 *
 * Features:
 *   - Smooth slide-in/out via Framer Motion
 *   - Backdrop overlay that closes on click
 *   - Icon + colour per notification type
 *   - Relative timestamp ("2h ago", "just now", etc.)
 *   - Unread items highlighted with left border + slightly brighter bg
 *   - "Mark all read" button (disabled when all already read)
 *   - "Clear all" button
 *   - Empty state illustration
 *   - Click a notification to mark it read
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, Calendar, Briefcase, BarChart2,
  Bell, CheckCheck, Trash2, Loader2,
} from 'lucide-react';
import { notificationsApi, AppNotification, NotificationType } from '@/services/notificationsApi';

// ── Type config ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; bg: string; dot: string }> = {
  SKILL_COMPLETE: {
    icon: <Sparkles size={15} />,
    bg:   'bg-violet-100 text-violet-600',
    dot:  'bg-violet-500',
  },
  INTERVIEW_REMINDER: {
    icon: <Calendar size={15} />,
    bg:   'bg-indigo-100 text-indigo-600',
    dot:  'bg-indigo-500',
  },
  JOB_MATCH: {
    icon: <Briefcase size={15} />,
    bg:   'bg-emerald-100 text-emerald-600',
    dot:  'bg-emerald-500',
  },
  WEEKLY_DIGEST: {
    icon: <BarChart2 size={15} />,
    bg:   'bg-sky-100 text-sky-600',
    dot:  'bg-sky-500',
  },
  SYSTEM: {
    icon: <Bell size={15} />,
    bg:   'bg-slate-100 text-slate-500',
    dot:  'bg-slate-400',
  },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type as NotificationType] ?? TYPE_CONFIG.SYSTEM;
}

// ── Relative timestamp ────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

// ── Props ────────────────────────────────────────────────────────────

interface Props {
  open:           boolean;
  onClose:        () => void;
  onCountChange?: (count: number) => void;  // fires after read/clear so Bell re-syncs
}

// ── Drawer ────────────────────────────────────────────────────────────

export default function NotificationDrawer({ open, onClose, onCountChange }: Props) {
  const [items,   setItems]   = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = items.filter(n => !n.read).length;

  async function load() {
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications(0, 50);
      setItems(res.items);
      onCountChange?.(res.unreadCount);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function handleMarkRead(id: string) {
    await notificationsApi.markRead(id).catch(() => {});
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    onCountChange?.(Math.max(0, unreadCount - 1));
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    onCountChange?.(0);
  }

  async function handleClearAll() {
    await notificationsApi.clearAll().catch(() => {});
    setItems([]);
    onCountChange?.(0);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 z-40 w-[380px] max-w-[95vw]
                       bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4
                            border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700
                                   text-xs font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    title="Mark all read"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs
                               font-semibold text-slate-500 hover:text-indigo-600
                               hover:bg-indigo-50 transition-colors"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    title="Clear all"
                    className="h-8 w-8 rounded-lg flex items-center justify-center
                               text-slate-400 hover:text-rose-500 hover:bg-rose-50
                               transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center
                             text-slate-400 hover:text-slate-700 hover:bg-slate-100
                             transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 size={22} className="animate-spin text-slate-300" />
                </div>
              ) : items.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-64 gap-4 px-8">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center
                                  justify-center">
                    <Bell size={28} className="text-slate-200" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700 mb-1">All caught up!</p>
                    <p className="text-xs text-slate-400">
                      New notifications will appear here when skills complete,
                      interview reminders fire, or new jobs are matched.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map(n => {
                    const cfg = getConfig(n.type);
                    return (
                      <li
                        key={n.id}
                        onClick={() => !n.read && handleMarkRead(n.id)}
                        className={[
                          'flex gap-3 px-5 py-4 transition-colors',
                          n.read
                            ? 'bg-white'
                            : 'bg-indigo-50/40 border-l-2 border-indigo-400 cursor-pointer hover:bg-indigo-50/70',
                        ].join(' ')}
                      >
                        {/* Type icon */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center
                                         shrink-0 mt-0.5 ${cfg.bg}`}>
                          {cfg.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-snug ${
                              n.read ? 'text-slate-600 font-normal' : 'text-slate-900 font-semibold'
                            }`}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${cfg.dot}`} />
                            )}
                          </div>
                          {n.body && (
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed
                                          line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
