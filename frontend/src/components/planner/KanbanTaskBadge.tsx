// Task 31 — KanbanTaskBadge: shows pending task count on each Kanban job card
import React, { useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';

interface Props {
  userJobId: string;
}

export const KanbanTaskBadge: React.FC<Props> = ({ userJobId }) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    axios.get(`/planner/tasks/${userJobId}`)
      .then(r => {
        const pending = r.data.filter((t: any) => t.status === 'PENDING').length;
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
