// Task 32 — QuickActionButtons: Follow up / Schedule prep / Final review buttons on Job Detail
import React, { useState } from 'react';
import { api as axios } from '@/services/api';

interface Props {
  userJobId: string;
  onTaskAdded?: () => void;
}

const QUICK_ACTIONS = [
  {
    label: '💬 Follow Up',
    taskType: 'FOLLOW_UP',
    priority: 'HIGH',
    title: 'Send follow-up email',
    description: 'Reach out to the recruiter or hiring manager for a status update.',
    daysFromNow: 1,
  },
  {
    label: '📖 Schedule Prep',
    taskType: 'PREP',
    priority: 'MEDIUM',
    title: 'Schedule interview preparation session',
    description: 'Block time to research the company, review the role, and practise answers.',
    daysFromNow: 2,
  },
  {
    label: '🔍 Final Review',
    taskType: 'REVIEW',
    priority: 'URGENT',
    title: 'Final review of application materials',
    description: 'Check CV, cover letter, and portfolio links before submission.',
    daysFromNow: 1,
  },
];

export const QuickActionButtons: React.FC<Props> = ({ userJobId, onTaskAdded }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [added, setAdded]     = useState<string[]>([]);

  const handleClick = async (action: typeof QUICK_ACTIONS[0]) => {
    setLoading(action.taskType);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + action.daysFromNow);

      await axios.post(`/planner/tasks/${userJobId}`, {
        title:       action.title,
        description: action.description,
        taskType:    action.taskType,
        priority:    action.priority,
        dueDate:     dueDate.toISOString(),
      });

      setAdded(prev => [...prev, action.taskType]);
      onTaskAdded?.();
    } catch {
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="quick-actions" role="group" aria-label="Quick actions">
      {QUICK_ACTIONS.map(action => (
        <button
          key={action.taskType}
          className={`quick-action-btn${added.includes(action.taskType) ? ' quick-action-btn--done' : ''}`}
          onClick={() => handleClick(action)}
          disabled={loading === action.taskType || added.includes(action.taskType)}
          aria-label={action.label}
        >
          {loading === action.taskType
            ? '⏳'
            : added.includes(action.taskType)
            ? '✓ Added'
            : action.label}
        </button>
      ))}
    </div>
  );
};
