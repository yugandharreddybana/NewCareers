// Task 31 — KanbanTaskBadge: shows pending task count on each Kanban job card
import React, { useEffect, useState } from 'react';
import { api as axios } from '@/services/api';
import type { PlannerTask } from '@/types';

interface Props {
  userJobId: string;
}

export const KanbanTaskBadge: React.FC<Props> = ({ userJobId }) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    axios.get<PlannerTask[]>(`/planner/tasks/${userJobId}`)
      .then(r => {
        const pending = r.data.filter(t => t.status === 'PENDING').length;
        setCount(pending);
      })
      .catch(() => {});
  }, [userJobId]);

  if (count === null || count === 0) return null;

  return (
    <span
      className="kanban-task-badge"
      aria-label={`${count} pending task${count !== 1 ? 's' : ''}`}
      title={`${count} pending task${count !== 1 ? 's' : ''}`}
    >
      {count}
    </span>
  );
};
