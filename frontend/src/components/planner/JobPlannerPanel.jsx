import React, { useState } from 'react';
import { useJobTasks, useJobDeadlines } from '../../hooks/usePlanner';
function format(date, fmt) {
  if (!date || isNaN(date.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  if (fmt === 'MMM d, yyyy') {
    return `${month} ${day}, ${year}`;
  }
  if (fmt === 'MMM d, yyyy • h:mm a') {
    return `${month} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
  }
  if (fmt === 'MMM d • h:mm a') {
    return `${month} ${day} • ${hours}:${minutes} ${ampm}`;
  }
  return date.toLocaleString();
}

const EVENT_TYPE_OPTIONS = [
  { value: 'APPLICATION_CLOSE', label: '📅 Application Close' },
  { value: 'INTERVIEW_DATE',    label: '🎙️ Interview Date' },
  { value: 'FOLLOW_UP',         label: '📬 Follow-Up' },
  { value: 'OFFER_DEADLINE',    label: '🤝 Offer Deadline' },
  { value: 'CUSTOM',            label: '📌 Custom' },
];

const STATUS_STYLE = {
  PENDING:     'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-600',
  DONE:        'bg-green-100 text-green-600 line-through',
  SKIPPED:     'bg-gray-100 text-gray-400 line-through',
};

const PRIORITY_DOT = {
  HIGH:   'bg-red-400',
  MEDIUM: 'bg-yellow-400',
  LOW:    'bg-green-400',
};

export default function JobPlannerPanel({ userJobId, jobTitle, onClose }) {
  const [tab, setTab] = useState('tasks'); // 'tasks' | 'deadlines'
  const { tasks, loading: tLoading, generate, complete } = useJobTasks(userJobId);
  const { deadlines, loading: dLoading, addDeadline } = useJobDeadlines(userJobId);

  // Add deadline form state
  const [showAddDeadline, setShowAddDeadline] = useState(false);
  const [dlForm, setDlForm] = useState({
    eventType: 'CUSTOM',
    title: '',
    notes: '',
    eventDate: '',
    remindAt: '',
  });
  const [dlSaving, setDlSaving] = useState(false);

  async function handleAddDeadline(e) {
    e.preventDefault();
    if (!dlForm.title || !dlForm.eventDate) return;
    setDlSaving(true);
    try {
      await addDeadline({
        ...dlForm,
        eventDate: new Date(dlForm.eventDate).toISOString(),
        remindAt:  dlForm.remindAt ? new Date(dlForm.remindAt).toISOString() : null,
      });
      setDlForm({ eventType: 'CUSTOM', title: '', notes: '', eventDate: '', remindAt: '' });
      setShowAddDeadline(false);
    } finally {
      setDlSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Application Planner</p>
          <h2 className="font-semibold text-gray-800 text-sm mt-0.5 truncate max-w-xs">{jobTitle}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-5 gap-4">
        {['tasks', 'deadlines'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'tasks' ? `📋 Tasks (${tasks.length})` : `📅 Deadlines (${deadlines.length})`}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div className="space-y-3">
            <button
              onClick={generate}
              disabled={tLoading}
              className="w-full py-2 rounded-xl border border-dashed border-blue-300
                         text-blue-500 text-sm hover:bg-blue-50 transition-colors"
            >
              {tLoading ? 'Loading…' : '✨ Generate Smart Tasks'}
            </button>

            {tasks.length === 0 && !tLoading && (
              <p className="text-center text-gray-400 text-sm py-8">
                No tasks yet. Hit "Generate Smart Tasks" to get started.
              </p>
            )}

            {tasks.map(task => (
              <div
                key={task.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-opacity ${
                  task.status === 'DONE' || task.status === 'SKIPPED'
                    ? 'opacity-50 border-gray-100'
                    : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                {/* Complete checkbox */}
                <button
                  onClick={() => task.status === 'PENDING' && complete(task.id)}
                  disabled={task.status === 'DONE' || task.status === 'SKIPPED'}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center
                               justify-center flex-shrink-0 transition-colors ${
                    task.status === 'DONE'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                  title="Mark complete"
                >
                  {task.status === 'DONE' && <span className="text-xs">✓</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    STATUS_STYLE[task.status]?.includes('line-through') ? 'line-through text-gray-400' : 'text-gray-700'
                  }`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>
                  )}
                  {task.dueDate && (
                    <p className="text-xs text-gray-400 mt-1">
                      Due {format(new Date(task.dueDate), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>

                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                  PRIORITY_DOT[task.priority] ?? 'bg-gray-300'
                }`} />
              </div>
            ))}
          </div>
        )}

        {/* ── DEADLINES TAB ── */}
        {tab === 'deadlines' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowAddDeadline(v => !v)}
              className="w-full py-2 rounded-xl border border-dashed border-blue-300
                         text-blue-500 text-sm hover:bg-blue-50 transition-colors"
            >
              {showAddDeadline ? '✕ Cancel' : '+ Add Deadline'}
            </button>

            {showAddDeadline && (
              <form onSubmit={handleAddDeadline} className="bg-gray-50 rounded-xl p-4 space-y-3">
                <select
                  value={dlForm.eventType}
                  onChange={e => setDlForm(f => ({ ...f, eventType: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
                >
                  {EVENT_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Title *"
                  value={dlForm.title}
                  onChange={e => setDlForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Event Date *</label>
                    <input
                      type="datetime-local"
                      value={dlForm.eventDate}
                      onChange={e => setDlForm(f => ({ ...f, eventDate: e.target.value }))}
                      required
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Remind me at</label>
                    <input
                      type="datetime-local"
                      value={dlForm.remindAt}
                      onChange={e => setDlForm(f => ({ ...f, remindAt: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-1"
                    />
                  </div>
                </div>

                <textarea
                  placeholder="Notes (optional)"
                  value={dlForm.notes}
                  onChange={e => setDlForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none"
                />

                <button
                  type="submit"
                  disabled={dlSaving}
                  className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm
                             rounded-xl transition-colors disabled:opacity-50"
                >
                  {dlSaving ? 'Saving…' : 'Save Deadline'}
                </button>
              </form>
            )}

            {deadlines.length === 0 && !dLoading && !showAddDeadline && (
              <p className="text-center text-gray-400 text-sm py-8">
                No deadlines yet. Add one above.
              </p>
            )}

            {deadlines.map(ev => (
              <div
                key={ev.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-gray-200"
              >
                <span className="text-xl flex-shrink-0">
                  {EVENT_TYPE_OPTIONS.find(o => o.value === ev.eventType)?.label.split(' ')[0] ?? '📌'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{ev.title}</p>
                  {ev.notes && <p className="text-xs text-gray-400 truncate">{ev.notes}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {format(new Date(ev.eventDate), 'MMM d, yyyy • h:mm a')}
                  </p>
                  {ev.remindAt && (
                    <p className="text-xs text-blue-400">
                      🔔 Remind at {format(new Date(ev.remindAt), 'MMM d • h:mm a')}
                    </p>
                  )}
                </div>
                {ev.completed && (
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Done</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
