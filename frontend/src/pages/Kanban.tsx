import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { AppShell } from '@/components/layout/AppShell';
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
      <AppShell>
        <div className="max-w-full px-4 sm:px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Application Board</h1>
              <p className="text-sm text-gray-500 mt-1">Drag cards across columns to update your application status.</p>
            </div>
            <span className="text-sm text-gray-400">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
          </div>

          {loading && (
            <div className="flex justify-center items-center h-64 text-gray-400 text-sm">
              Loading board…
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
      </AppShell>
    </>
  );
};

export default Kanban;
