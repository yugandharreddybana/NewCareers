import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { jobsApi } from '@/services/api';
import type { JobCard } from '@/types';

const Kanban: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    jobsApi.list()
      .then(res => setJobs(res.items))
      .catch(() => setError('Failed to load jobs.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageMeta title="Kanban Board — CareerOps" />
      <div className="max-w-full">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-sm text-gray-400 mt-0.5">
              Drag cards across columns to track your application pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-3 py-1">
              {jobs.length} job{jobs.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col justify-center items-center h-64 text-gray-300">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <span className="text-sm">Loading board…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex justify-center items-center h-64 text-red-500 text-sm">{error}</div>
        )}

        {!loading && !error && (
          <KanbanBoard
            jobs={jobs}
            onJobClick={job => navigate(`/jobs/${job.jobId}`)}
            onColumnChange={(job, newCol) => {
              setJobs(prev => prev.map(j =>
                j.userJobId === job.userJobId ? { ...j, kanbanColumn: newCol } : j
              ));
            }}
          />
        )}
      </div>
    </>
  );
};

export default Kanban;
