import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface Notification {
  id: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface Props {
  onClose: () => void;
}

const NotificationsPanel: React.FC<Props> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/notifications')
      .then(res => setNotifications(res.data))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = () => {
    api.patch('/api/notifications/mark-all-read')
      .then(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        width: 360,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 200,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.875rem 1rem',
        borderBottom: '1px solid var(--color-divider)',
      }}>
        <span style={{ fontWeight: 600 }}>
          Notifications {unreadCount > 0 && <span style={{
            background: 'var(--color-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.7rem',
            padding: '0.1rem 0.45rem',
            marginLeft: '0.4rem',
          }}>{unreadCount}</span>}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{ fontSize: '0.8rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close notifications"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        )}
        {!loading && notifications.length === 0 && (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</div>
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>You're all caught up!</p>
          </div>
        )}
        {!loading && notifications.map(n => (
          <div
            key={n.id}
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--color-divider)',
              background: n.read ? 'transparent' : 'var(--color-primary-highlight)',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : 'var(--color-primary)', flexShrink: 0, marginTop: '0.35rem' }} />
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>{n.message}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPanel;
