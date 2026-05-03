import React, { useCallback, useEffect, useRef, useState } from 'react';
import { kanbanApi } from '@/services/api';
import type { JobCard, KanbanColumn } from '@/types';
import { KANBAN_COLUMNS } from '@/types';
import AppliedCvModal from './AppliedCvModal';
import toast from 'react-hot-toast';

const COLUMN_COLOURS: Record<KanbanColumn, string> = {
  Discovered: 'bg-gray-100 border-gray-200',
  Saved:      'bg-blue-50  border-blue-200',
  Applied:    'bg-yellow-50 border-yellow-200',
  Interview:  'bg-purple-50 border-purple-200',
  Offer:      'bg-emerald-50 border-emerald-200',
  Rejected:   'bg-red-50   border-red-200',
};

const COLUMN_DOT: Record<KanbanColumn, string> = {
  Discovered: 'bg-gray-400',
  Saved:      'bg-blue-400',
  Applied:    'bg-yellow-400',
  Interview:  'bg-purple-500',
  Offer:      'bg-emerald-500',
  Rejected:   'bg-red-400',
};

interface Props {
  jobs: JobCard[];
  onJobClick?: (job: JobCard) => void;
  onColumnChange?: (job: JobCard, newCol: KanbanColumn) => void;
}

interface DragState {
  jobId: string;
  sourceCol: KanbanColumn;
}

export const KanbanBoard: React.FC<Props> = ({ jobs: initialJobs, onJobClick, onColumnChange }) => {
  const [jobs, setJobs] = useState<JobCard[]>(initialJobs);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [overCol, setOverCol] = useState<KanbanColumn | null>(null);
  const [cvModal, setCvModal] = useState<{ userJobId: string; jobTitle: string } | null>(null);
  const patchInFlight = useRef<Set<string>>(new Set());

  useEffect(() => { setJobs(initialJobs); }, [initialJobs]);

  const byColumn = useCallback((col: KanbanColumn) =>
    jobs.filter(j => j.kanbanColumn === col), [jobs]);

  const handleDragStart = (e: React.DragEvent, job: JobCard) => {
    setDragging({ jobId: job.userJobId, sourceCol: job.kanbanColumn });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetCol: KanbanColumn) => {
    e.preventDefault();
    if (!dragging || dragging.sourceCol === targetCol) { setDragging(null); setOverCol(null); return; }

    const job = jobs.find(j => j.userJobId === dragging.jobId);
    if (!job) return;

    // Optimistic update
    setJobs(prev => prev.map(j =>
      j.userJobId === dragging.jobId ? { ...j, kanbanColumn: targetCol } : j
    ));
    setDragging(null);
    setOverCol(null);

    // Show CV modal when moving to Applied
    if (targetCol === 'Applied') {
      setCvModal({ userJobId: job.userJobId, jobTitle: job.title });
    }

    if (patchInFlight.current.has(job.userJobId)) return;
    patchInFlight.current.add(job.userJobId);

    try {
      await kanbanApi.patch(job.userJobId, { kanbanColumn: targetCol });
      onColumnChange?.(job, targetCol);
    } catch {
      // Roll back
      setJobs(prev => prev.map(j =>
        j.userJobId === dragging.jobId ? { ...j, kanbanColumn: dragging.sourceCol } : j
      ));
      toast.error('Failed to move card. Please try again.');
    } finally {
      patchInFlight.current.delete(job.userJobId);
    }
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[70vh]">
        {KANBAN_COLUMNS.map(col => (
          <div
            key={col}
            className={`flex-shrink-0 w-64 rounded-xl border-2 p-3 transition-colors ${
              COLUMN_COLOURS[col]
            } ${
              overCol === col ? 'ring-2 ring-emerald-400' : ''
            }`}
            onDragOver={e => { e.preventDefault(); setOverCol(col); }}
            onDragLeave={() => setOverCol(null)}
            onDrop={e => handleDrop(e, col)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${COLUMN_DOT[col]}`} />
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{col}</span>
              </div>
              <span className="text-xs text-gray-400 font-medium">{byColumn(col).length}</span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {byColumn(col).length === 0 && (
                <div className="py-8 text-center text-xs text-gray-400">Drop here</div>
              )}
              {byColumn(col).map(job => (
                <div
                  key={job.userJobId}
                  draggable
                  onDragStart={e => handleDragStart(e, job)}
                  onClick={() => onJobClick?.(job)}
                  className="bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow select-none"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{job.company}</p>
                  {job.matchPercent !== undefined && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            job.matchPercent >= 75 ? 'bg-emerald-500' :
                            job.matchPercent >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${job.matchPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{job.matchPercent}%</span>
                    </div>
                  )}
                  {job.location && (
                    <p className="mt-1.5 text-xs text-gray-400 truncate">📍 {job.location}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {cvModal && (
        <AppliedCvModal
          userJobId={cvModal.userJobId}
          jobTitle={cvModal.jobTitle}
          onClose={() => setCvModal(null)}
        />
      )}
    </>
  );
};

export default KanbanBoard;
