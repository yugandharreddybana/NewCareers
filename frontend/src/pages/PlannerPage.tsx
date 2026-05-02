import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────
interface ApplicationTask {
  id: number;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  dueDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  jobTitle?: string;
  companyName?: string;
  createdAt: string;
}

interface DeadlineEvent {
  id: number;
  title: string;
  eventDate: string;
  eventType: string;
  notes?: string;
  jobTitle?: string;
  companyName?: string;
}

interface CreateTaskPayload {
  title: string;
  description?: string;
  status: ApplicationTask['status'];
  priority: ApplicationTask['priority'];
  dueDate?: string;
}

interface CreateDeadlinePayload {
  title: string;
  eventDate: string;
  eventType: string;
  notes?: string;
}

const STATUSES: ApplicationTask['status'][] = ['TODO', 'IN_PROGRESS', 'DONE'];
const PRIORITIES: ApplicationTask['priority'][] = ['LOW', 'MEDIUM', 'HIGH'];

const STATUS_LABELS: Record<ApplicationTask['status'], string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

const STATUS_COLORS: Record<ApplicationTask['status'], string> = {
  TODO: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
};

const PRIORITY_COLORS: Record<ApplicationTask['priority'], string> = {
  LOW: 'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-600',
};

const EVENT_TYPES = ['APPLICATION_DEADLINE', 'INTERVIEW', 'FOLLOW_UP', 'OFFER_DEADLINE', 'OTHER'];

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isPast(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// ── Sub-components ────────────────────────────────────────────────────────
interface TaskCardProps {
  task: ApplicationTask;
  onStatusChange: (id: number, status: ApplicationTask['status']) => void;
  onDelete: (id: number) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onDelete }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between gap-2 mb-2">
      <h3 className="font-semibold text-slate-800 text-sm leading-snug">{task.title}</h3>
      <button
        onClick={() => onDelete(task.id)}
        className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
        aria-label="Delete task"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>

    {task.description && (
      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{task.description}</p>
    )}

    {(task.jobTitle || task.companyName) && (
      <p className="text-xs text-indigo-500 mb-2 font-medium">
        {task.companyName}{task.jobTitle ? ` · ${task.jobTitle}` : ''}
      </p>
    )}

    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
        {task.priority}
      </span>
      {task.dueDate && (
        <span className={`text-xs ${isPast(task.dueDate) && task.status !== 'DONE' ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
          Due {formatDate(task.dueDate)}
        </span>
      )}
    </div>

    <select
      value={task.status}
      onChange={(e) => onStatusChange(task.id, e.target.value as ApplicationTask['status'])}
      className={`w-full text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer focus:ring-2 focus:ring-indigo-300 ${STATUS_COLORS[task.status]}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
      ))}
    </select>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────
const PlannerPage: React.FC = () => {
  const { user } = useAuth();

  // Tasks state
  const [tasks, setTasks] = useState<ApplicationTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Deadlines state
  const [deadlines, setDeadlines] = useState<DeadlineEvent[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState<'tasks' | 'deadlines'>('tasks');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ApplicationTask['status'] | 'ALL'>('ALL');

  // Task form
  const [taskForm, setTaskForm] = useState<CreateTaskPayload>({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
  });
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // Deadline form
  const [deadlineForm, setDeadlineForm] = useState<CreateDeadlinePayload>({
    title: '',
    eventDate: '',
    eventType: 'APPLICATION_DEADLINE',
    notes: '',
  });
  const [deadlineSubmitting, setDeadlineSubmitting] = useState(false);

  // ── Fetch tasks ──────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await apiClient.get<ApplicationTask[]>('/api/planner/tasks');
      setTasks(res.data);
    } catch {
      setTasksError('Failed to load tasks. Please try again.');
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // ── Fetch deadlines ──────────────────────────────────────────────────────
  const fetchDeadlines = useCallback(async () => {
    setDeadlinesLoading(true);
    try {
      const res = await apiClient.get<DeadlineEvent[]>('/api/planner/deadlines');
      setDeadlines(res.data);
    } catch {
      // silently fail deadlines — non-critical
    } finally {
      setDeadlinesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchDeadlines();
  }, [fetchTasks, fetchDeadlines]);

  // ── Task CRUD ────────────────────────────────────────────────────────────
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setTaskSubmitting(true);
    try {
      await apiClient.post('/api/planner/tasks', {
        ...taskForm,
        dueDate: taskForm.dueDate || undefined,
        description: taskForm.description || undefined,
      });
      setTaskForm({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', dueDate: '' });
      setShowTaskForm(false);
      await fetchTasks();
    } catch {
      // handle error
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleStatusChange = async (id: number, status: ApplicationTask['status']) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await apiClient.patch(`/api/planner/tasks/${id}/status`, { status });
    } catch {
      await fetchTasks(); // revert on error
    }
  };

  const handleDeleteTask = async (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await apiClient.delete(`/api/planner/tasks/${id}`);
    } catch {
      await fetchTasks();
    }
  };

  // ── Deadline CRUD ────────────────────────────────────────────────────────
  const handleCreateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadlineForm.title.trim() || !deadlineForm.eventDate) return;
    setDeadlineSubmitting(true);
    try {
      await apiClient.post('/api/planner/deadlines', {
        ...deadlineForm,
        notes: deadlineForm.notes || undefined,
      });
      setDeadlineForm({ title: '', eventDate: '', eventType: 'APPLICATION_DEADLINE', notes: '' });
      setShowDeadlineForm(false);
      await fetchDeadlines();
    } catch {
      // handle
    } finally {
      setDeadlineSubmitting(false);
    }
  };

  const handleDeleteDeadline = async (id: number) => {
    setDeadlines((prev) => prev.filter((d) => d.id !== id));
    try {
      await apiClient.delete(`/api/planner/deadlines/${id}`);
    } catch {
      await fetchDeadlines();
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const filteredTasks = filterStatus === 'ALL'
    ? tasks
    : tasks.filter((t) => t.status === filterStatus);

  const tasksByStatus = STATUSES.reduce<Record<ApplicationTask['status'], ApplicationTask[]>>(
    (acc, s) => ({ ...acc, [s]: filteredTasks.filter((t) => t.status === s) }),
    { TODO: [], IN_PROGRESS: [], DONE: [] }
  );

  const upcomingDeadlines = deadlines
    .filter((d) => !isPast(d.eventDate))
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    .slice(0, 5);

  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const overdueCount = tasks.filter(
    (t) => t.status !== 'DONE' && isPast(t.dueDate)
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Application Planner</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Hi {user?.firstName ?? 'there'} — track your tasks and upcoming deadlines
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowTaskForm(true); setShowDeadlineForm(false); }}
              className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Task
            </button>
            <button
              onClick={() => { setShowDeadlineForm(true); setShowTaskForm(false); }}
              className="flex items-center gap-1.5 border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Add Deadline
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'To Do', value: todoCount, color: 'text-slate-700', bg: 'bg-slate-100' },
            { label: 'In Progress', value: inProgressCount, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Done', value: doneCount, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Overdue', value: overdueCount, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-4`}>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Upcoming Deadlines Banner */}
        {upcomingDeadlines.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-sm font-semibold text-amber-800">Upcoming Deadlines</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {upcomingDeadlines.map((d) => (
                <div key={d.id} className="bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
                  <span className="font-medium text-slate-700">{d.title}</span>
                  <span className="text-amber-600 ml-2">{formatDate(d.eventDate)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {(['tasks', 'deadlines'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              {(['ALL', ...STATUSES] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {tasksError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
                {tasksError}
                <button onClick={fetchTasks} className="ml-3 underline text-red-600 hover:text-red-800">Retry</button>
              </div>
            )}

            {tasksLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STATUSES.map((s) => (
                  <div key={s} className="space-y-3">
                    <div className="h-5 bg-slate-200 rounded animate-pulse w-24" />
                    {[1, 2].map((i) => (
                      <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                        <div className="h-4 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {STATUSES.map((status) => (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="text-xs text-slate-400">{tasksByStatus[status].length}</span>
                    </div>
                    <div className="space-y-3">
                      {tasksByStatus[status].length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
                          <p className="text-xs text-slate-400">No tasks here</p>
                        </div>
                      ) : (
                        tasksByStatus[status].map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDeleteTask}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deadlines Tab */}
        {activeTab === 'deadlines' && (
          <div className="space-y-3">
            {deadlinesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : deadlines.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center">
                <svg className="mx-auto mb-3 text-slate-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="text-sm font-medium text-slate-600">No deadlines yet</p>
                <p className="text-xs text-slate-400 mt-1">Add important dates so you never miss a deadline</p>
                <button
                  onClick={() => setShowDeadlineForm(true)}
                  className="mt-4 text-sm text-indigo-600 font-medium hover:underline"
                >
                  Add your first deadline
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {deadlines
                  .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
                  .map((d) => (
                    <div
                      key={d.id}
                      className={`bg-white rounded-xl border p-4 flex items-center justify-between ${
                        isPast(d.eventDate) ? 'border-red-200 opacity-60' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800 text-sm">{d.title}</p>
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            {d.eventType.replace(/_/g, ' ')}
                          </span>
                          {isPast(d.eventDate) && (
                            <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">Past</span>
                          )}
                        </div>
                        {d.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{d.notes}</p>}
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                          {formatDate(d.eventDate)}
                        </span>
                        <button
                          onClick={() => handleDeleteDeadline(d.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors"
                          aria-label="Delete deadline"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">New Task</h2>
              <button onClick={() => setShowTaskForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Submit cover letter for Google"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional notes..."
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value as ApplicationTask['priority'] }))}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm((p) => ({ ...p, status: e.target.value as ApplicationTask['status'] }))}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTaskForm(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSubmitting || !taskForm.title.trim()}
                  className="flex-1 bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {taskSubmitting ? 'Saving...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Deadline Modal */}
      {showDeadlineForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Add Deadline</h2>
              <button onClick={() => setShowDeadlineForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateDeadline} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={deadlineForm.title}
                  onChange={(e) => setDeadlineForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Google application closes"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={deadlineForm.eventDate}
                    onChange={(e) => setDeadlineForm((p) => ({ ...p, eventDate: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select
                    value={deadlineForm.eventType}
                    onChange={(e) => setDeadlineForm((p) => ({ ...p, eventType: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={deadlineForm.notes}
                  onChange={(e) => setDeadlineForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeadlineForm(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deadlineSubmitting || !deadlineForm.title.trim() || !deadlineForm.eventDate}
                  className="flex-1 bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {deadlineSubmitting ? 'Saving...' : 'Add Deadline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannerPage;
