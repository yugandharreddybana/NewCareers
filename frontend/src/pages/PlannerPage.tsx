import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import {
  Calendar, CheckCircle, Circle, Plus, Trash2,
  Clock, Flag,
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  userJobId?: string;
}

interface Deadline {
  id: string;
  title: string;
  eventDate: string;
  eventType: 'interview' | 'assessment' | 'offer_deadline' | 'follow_up';
  userJobId?: string;
}

const PRIORITY_STYLES = {
  high:   { dot: 'bg-red-400',    label: 'bg-red-100 text-red-600' },
  medium: { dot: 'bg-amber-400',  label: 'bg-amber-100 text-amber-600' },
  low:    { dot: 'bg-gray-300',   label: 'bg-gray-100 text-gray-500' },
};

const EVENT_STYLES: Record<Deadline['eventType'], string> = {
  interview:      'bg-indigo-100 text-indigo-700',
  assessment:     'bg-purple-100 text-purple-700',
  offer_deadline: 'bg-emerald-100 text-emerald-700',
  follow_up:      'bg-blue-100 text-blue-700',
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  if (diff <= 0) return { label, urgent: true };
  if (diff === 1) return { label: 'Tomorrow', urgent: true };
  return { label, urgent: diff <= 2 };
}

const PlannerPage: React.FC = () => {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading]     = useState(true);
  const [newTitle, setNewTitle]   = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium');
  const [newDue, setNewDue]       = useState('');
  const [adding, setAdding]       = useState(false);
  const [showForm, setShowForm]   = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [t, d] = await Promise.all([
          api.get('/planner/tasks').then(r => r.data),
          api.get('/planner/deadlines').then(r => r.data),
        ]);
        setTasks(t as Task[]);
        setDeadlines(d as Deadline[]);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleToggle = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    try { await api.patch(`/planner/tasks/${id}/toggle`); }
    catch { toast.error('Failed to update task.'); }
  };

  const handleDelete = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await api.delete(`/planner/tasks/${id}`); }
    catch { toast.error('Failed to delete task.'); }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) { toast.error('Task title is required.'); return; }
    setAdding(true);
    try {
      const body = { title: newTitle, priority: newPriority, dueDate: newDue || null };
      const task: Task = await api.post('/planner/tasks', body).then(r => r.data);
      setTasks(prev => [task, ...prev]);
      setNewTitle(''); setNewDue(''); setNewPriority('medium'); setShowForm(false);
      toast.success('Task added!');
    } catch { toast.error('Failed to add task.'); }
    finally { setAdding(false); }
  };

  if (loading) return <PageLoader />;

  const pending   = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  const today     = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <PageMeta title="Planner — CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Planner</h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5"><Calendar size={13} />{today}</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={15} /> Add Task
          </button>
        </div>

        {/* Add task form */}
        {showForm && (
          <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700">New Task</p>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What needs to be done?"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <div className="flex gap-3">
              <select aria-label="Priority" value={newPriority} onChange={e => setNewPriority(e.target.value as Task['priority'])}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input aria-label="Due Date" type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={adding} className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                {adding ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
        )}

        {/* Upcoming deadlines */}
        {deadlines.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Flag size={14} className="text-red-400" /> Upcoming Deadlines</h2>
            <div className="space-y-2">
              {deadlines.map(d => {
                const { label, urgent } = fmtDate(d.eventDate);
                return (
                  <div key={d.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${ urgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.title}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${EVENT_STYLES[d.eventType]}`}>{d.eventType.replace('_', ' ')}</span>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${ urgent ? 'text-red-600' : 'text-gray-600'}`}>{label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending tasks */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Tasks ({pending.length} pending)</h2>
          {pending.length === 0 && <p className="text-sm text-gray-400 text-center py-6">🎉 All caught up!</p>}
          <div className="space-y-1">
            {pending.map(t => {
              const due = t.dueDate ? fmtDate(t.dueDate) : null;
              return (
                <div key={t.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 group">
                  <button aria-label="Mark as complete" onClick={() => handleToggle(t.id)} className="shrink-0 text-gray-300 hover:text-indigo-500 transition-colors">
                    <Circle size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{t.title}</p>
                    {due && <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${ due.urgent ? 'text-red-500 font-semibold' : 'text-gray-400'}`}><Clock size={10} />{due.label}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_STYLES[t.priority].dot}`} />
                    <button aria-label="Delete task" onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completed */}
        {completed.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Completed ({completed.length})</h2>
            <div className="space-y-1">
              {completed.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-2 py-2 rounded-lg opacity-50">
                  <button aria-label="Mark as incomplete" onClick={() => handleToggle(t.id)} className="shrink-0 text-emerald-400">
                    <CheckCircle size={18} />
                  </button>
                  <p className="text-sm text-gray-500 line-through">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default PlannerPage;
