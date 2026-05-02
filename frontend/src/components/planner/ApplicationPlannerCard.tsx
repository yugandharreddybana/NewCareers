// Task 26 — ApplicationPlannerCard: Dashboard widget showing upcoming tasks and quick actions
import React, { useEffect, useState, useCallback } from 'react';
import axios from '../../api/axiosInstance';

interface Task {
  id: string;
  title: string;
  taskType: string;
  priority: string;
  status: string;
  dueDate: string | null;
  userJobId: string;
}

const PRIORITY_CLASS: Record<string, string> = {
  URGENT: 'priority-badge--urgent',
  HIGH:   'priority-badge--high',
  MEDIUM: 'priority-badge--medium',
  LOW:    'priority-badge--low',
};

const TYPE_ICON: Record<string, string> = {
  FOLLOW_UP: '💬',
  PREP:      '📖',
  REVIEW:    '🔍',
  SUBMIT:    '🚀',
  ACTION:    '✅',
};

export const ApplicationPlannerCard: React.FC = () => {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchUpcoming = useCallback(() => {
    setLoading(true);
    axios.get<Task[]>('/planner/upcoming')
      .then(r => setTasks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchUpcoming(); }, [fetchUpcoming]);

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    try {
      await axios.patch(`/planner/task/${taskId}`, { status: 'COMPLETED' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch {
    } finally {
      setCompleting(null);
    }
  };

  const formatDue = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const today = new Date();
    const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0)  return { label: 'Overdue', cls: 'due-tag--overdue' };
    if (diffDays === 0) return { label: 'Today', cls: 'due-tag--today' };
    if (diffDays === 1) return { label: 'Tomorrow', cls: 'due-tag--soon' };
    return { label: `${diffDays}d`, cls: 'due-tag--normal' };
  };

  if (loading) return (
    <div className="planner-card">
      <div className="planner-card__header"><div className="skeleton skeleton-heading" /></div>
      {[1,2,3].map(i => <div key={i} className="skeleton skeleton-text" style={{ height: '44px', marginBottom: '8px' }} />)}
    </div>
  );

  return (
    <div className="planner-card" aria-label="Application Planner">
      <div className="planner-card__header">
        <h3 className="planner-card__title">📋 Your Tasks</h3>
        <span className="planner-card__count">{tasks.length} upcoming</span>
      </div>

      {tasks.length === 0 && (
        <div className="planner-card__empty">
          <span className="planner-card__empty-icon">🎉</span>
          <p>All clear! No pending tasks in the next 14 days.</p>
        </div>
      )}

      <ul className="planner-task-list" role="list">
        {tasks.map(task => {
          const due = formatDue(task.dueDate);
          return (
            <li key={task.id} className="planner-task-item">
              <button
                className="planner-task-item__complete"
                onClick={() => handleComplete(task.id)}
                disabled={completing === task.id}
                aria-label={`Mark "${task.title}" complete`}
              >
                {completing === task.id ? '⏳' : '○'}
              </button>
              <div className="planner-task-item__body">
                <span className="planner-task-item__icon">{TYPE_ICON[task.taskType] || '✅'}</span>
                <span className="planner-task-item__title">{task.title}</span>
              </div>
              <div className="planner-task-item__meta">
                <span className={`priority-badge ${PRIORITY_CLASS[task.priority] || ''}`}>
                  {task.priority}
                </span>
                {due && (
                  <span className={`due-tag ${due.cls}`}>{due.label}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
