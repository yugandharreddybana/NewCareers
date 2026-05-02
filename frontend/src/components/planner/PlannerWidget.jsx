import React, { useState } from 'react';
import { useUpcoming } from '../../hooks/usePlanner';

function isToday(d) {
  const today = new Date();
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
}

function isTomorrow(d) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getDate() === tomorrow.getDate() &&
         d.getMonth() === tomorrow.getMonth() &&
         d.getFullYear() === tomorrow.getFullYear();
}

function isPast(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const PRIORITY_COLOURS = {
  HIGH:   'bg-red-100 text-red-700 border-red-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW:    'bg-green-100 text-green-700 border-green-200',
};

const EVENT_ICONS = {
  APPLICATION_CLOSE: '📅',
  INTERVIEW_DATE:    '🎙️',
  FOLLOW_UP:         '📬',
  OFFER_DEADLINE:    '🤝',
  CUSTOM:            '📌',
};

export default function PlannerWidget({ onOpenJob }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useUpcoming(refreshKey);

  const { pendingTasks = [], upcomingEvents = [], overdueTasks = [] } = data;
  const overdueCount = overdueTasks.length;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded mb-2" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-base flex items-center gap-2">
          🗓️ Application Planner
          {overdueCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1
                             bg-red-500 text-white text-xs font-bold rounded-full">
              {overdueCount}
            </span>
          )}
        </h2>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
          title="Refresh"
        >↺</button>
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <div>
            <p className="text-red-700 text-sm font-medium">
              {overdueCount} overdue task{overdueCount > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 space-y-0.5">
              {overdueTasks.slice(0, 3).map(t => (
                <li key={t.id} className="text-red-600 text-xs truncate">
                  • {t.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Upcoming deadlines */}
      {upcomingEvents.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deadlines</p>
          <ul className="space-y-2">
            {upcomingEvents.slice(0, 4).map(ev => (
              <li
                key={ev.id}
                className="flex items-center gap-3 text-sm cursor-pointer group"
                onClick={() => onOpenJob?.(ev.userJobId)}
              >
                <span className="text-lg">{EVENT_ICONS[ev.eventType] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-gray-700 group-hover:text-blue-600 transition-colors">
                    {ev.title}
                  </p>
                </div>
                <span className={`text-xs font-medium ${
                  isPast(new Date(ev.eventDate)) ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {formatDate(ev.eventDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pending tasks */}
      {pendingTasks.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tasks</p>
          <ul className="space-y-2">
            {pendingTasks.slice(0, 5).map(t => (
              <li
                key={t.id}
                className="flex items-center gap-3 text-sm cursor-pointer group"
                onClick={() => onOpenJob?.(t.userJobId)}
              >
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                  t.priority === 'HIGH' ? 'bg-red-400' :
                  t.priority === 'MEDIUM' ? 'bg-yellow-400' : 'bg-green-400'
                }`} />
                <p className="flex-1 truncate text-gray-700 group-hover:text-blue-600 transition-colors">
                  {t.title}
                </p>
                {t.dueDate && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDate(t.dueDate)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Empty state */}
      {pendingTasks.length === 0 && upcomingEvents.length === 0 && overdueCount === 0 && (
        <div className="text-center py-4">
          <p className="text-3xl mb-1">✅</p>
          <p className="text-sm text-gray-500">All caught up! No pending tasks.</p>
        </div>
      )}
    </div>
  );
}
