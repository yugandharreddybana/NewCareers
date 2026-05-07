import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { kanbanApi } from '@/services/api';
import type { JobCard, KanbanColumn } from '@/types';
import { KANBAN_COLUMNS } from '@/types';
import AppliedCvModal from './AppliedCvModal';
import toast from 'react-hot-toast';

// Curated high-end enterprise SaaS color tokens
const COLUMN_STYLES: Record<KanbanColumn, {
  bg: string;
  dot: string;
  headerBg: string;
  dropRing: string;
  icon: string;
  border: string;
  accent: string;
  label: string;
}> = {
  Discovered: {
    bg: 'bg-slate-50/40 backdrop-blur-sm',
    dot: 'bg-slate-400',
    headerBg: 'bg-slate-100/80 border-slate-200/60',
    border: 'border-slate-200/50',
    dropRing: 'ring-slate-400/40',
    accent: 'bg-slate-500',
    icon: '🔍',
    label: 'Discovered',
  },
  Saved: {
    bg: 'bg-indigo-50/20 backdrop-blur-sm',
    dot: 'bg-indigo-500',
    headerBg: 'bg-indigo-50/60 border-indigo-100/50',
    border: 'border-indigo-100/40',
    dropRing: 'ring-indigo-400/40',
    accent: 'bg-indigo-600',
    icon: '⭐️',
    label: 'Saved',
  },
  Applied: {
    bg: 'bg-amber-50/20 backdrop-blur-sm',
    dot: 'bg-amber-500',
    headerBg: 'bg-amber-50/60 border-amber-100/50',
    border: 'border-amber-100/40',
    dropRing: 'ring-amber-400/40',
    accent: 'bg-amber-600',
    icon: '✉️',
    label: 'Applied',
  },
  Interview: {
    bg: 'bg-violet-50/20 backdrop-blur-sm',
    dot: 'bg-violet-500',
    headerBg: 'bg-violet-50/60 border-violet-100/50',
    border: 'border-violet-100/40',
    dropRing: 'ring-violet-400/40',
    accent: 'bg-violet-600',
    icon: '📅',
    label: 'Interviewing',
  },
  Offer: {
    bg: 'bg-emerald-50/20 backdrop-blur-sm',
    dot: 'bg-emerald-500',
    headerBg: 'bg-emerald-50/60 border-emerald-100/50',
    border: 'border-emerald-100/40',
    dropRing: 'ring-emerald-400/40',
    accent: 'bg-emerald-600',
    icon: '🎉',
    label: 'Offered',
  },
  Rejected: {
    bg: 'bg-rose-50/20 backdrop-blur-sm',
    dot: 'bg-rose-400',
    headerBg: 'bg-rose-50/60 border-rose-100/50',
    border: 'border-rose-100/40',
    dropRing: 'ring-rose-400/40',
    accent: 'bg-rose-600',
    icon: '❌',
    label: 'Archived',
  },
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

interface MoveJobPayload {
  job: JobCard;
  sourceCol: KanbanColumn;
  targetCol: KanbanColumn;
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

  const moveJobMutation = useMutation<void, unknown, MoveJobPayload>({
    mutationFn: async ({ job, targetCol }) => {
      await kanbanApi.patch(job.userJobId, { kanbanColumn: targetCol });
    },
    onMutate: ({ job, targetCol }) => {
      patchInFlight.current.add(job.userJobId);
      setJobs(prev => prev.map(item =>
        item.userJobId === job.userJobId ? { ...item, kanbanColumn: targetCol } : item,
      ));

      if (targetCol === 'Applied') {
        setCvModal({ userJobId: job.userJobId, jobTitle: job.title });
      }
    },
    onSuccess: (_data, { job, targetCol }) => {
      onColumnChange?.(job, targetCol);
    },
    onError: (_error, { job, sourceCol }) => {
      setJobs(prev => prev.map(item =>
        item.userJobId === job.userJobId ? { ...item, kanbanColumn: sourceCol } : item,
      ));
      toast.error('Failed to move card. Please try again.');
    },
    onSettled: (_data, _error, { job }) => {
      patchInFlight.current.delete(job.userJobId);
    },
  });

  const handleDragStart = (e: React.DragEvent, job: JobCard) => {
    setDragging({ jobId: job.userJobId, sourceCol: job.kanbanColumn });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetCol: KanbanColumn) => {
    e.preventDefault();
    if (!dragging || dragging.sourceCol === targetCol) { setDragging(null); setOverCol(null); return; }

    const job = jobs.find(j => j.userJobId === dragging.jobId);
    if (!job) {
      setDragging(null);
      setOverCol(null);
      return;
    }

    if (patchInFlight.current.has(job.userJobId)) {
      setDragging(null);
      setOverCol(null);
      toast.error('This card is still saving. Please wait a moment.');
      return;
    }

    const { sourceCol } = dragging;
    setDragging(null);
    setOverCol(null);

    moveJobMutation.mutate({ job, sourceCol, targetCol });
  };

  return (
    <>
      {/* SaaS Flexible Board Layout — each column gets generous width & horizontal scroll if needed */}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 min-h-[calc(100vh-210px)] select-none">
        {KANBAN_COLUMNS.map(col => {
          const style = COLUMN_STYLES[col];
          const colJobs = byColumn(col);
          const isOver = overCol === col;

          return (
            <div
              key={col}
              className={`
                flex-shrink-0 w-[310px] rounded-2xl border flex flex-col transition-all duration-200
                ${style.bg} ${style.border}
                ${isOver ? `ring-2 ${style.dropRing} shadow-xl scale-[1.01] bg-white/70` : 'shadow-sm hover:shadow-md'}
              `}
              onDragOver={e => { e.preventDefault(); setOverCol(col); }}
              onDragLeave={() => setOverCol(null)}
              onDrop={e => handleDrop(e, col)}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3.5 py-3 border-b rounded-t-2xl bg-white/50 ${style.headerBg}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm select-none">{style.icon}</span>
                  <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">{style.label}</span>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-white/80 border border-slate-100 rounded-full px-2.5 py-0.5 min-w-[24px] text-center shadow-sm">
                  {colJobs.length}
                </span>
              </div>

              {/* Cards area */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                {colJobs.length === 0 && (
                  <div className={`
                    flex flex-col items-center justify-center py-12 rounded-xl
                    border-2 border-dashed border-slate-200/50 text-slate-300
                    transition-all duration-200 ${isOver ? 'border-indigo-300 bg-white/40 text-indigo-400' : ''}
                  `}>
                    <span className="text-3xl mb-1.5 opacity-40 select-none">{style.icon}</span>
                    <span className="text-xs font-medium">Drag jobs here</span>
                  </div>
                )}
                {colJobs.map(job => (
                  <div
                    key={job.userJobId}
                    draggable
                    onDragStart={e => handleDragStart(e, job)}
                    onClick={() => onJobClick?.(job)}
                    className="
                      bg-white rounded-xl border border-slate-100/80 p-3.5
                      cursor-grab active:cursor-grabbing
                      shadow-sm hover:shadow-lg hover:border-indigo-100
                      transition-all duration-200 select-none
                      hover:-translate-y-1 active:scale-[0.98]
                      group relative overflow-hidden
                    "
                  >
                    {/* Left Accent Bar */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1 ${style.accent} opacity-0 group-hover:opacity-100 transition-all duration-200`} />

                    {/* Job Title */}
                    <p className="text-[13px] font-bold text-slate-800 leading-normal line-clamp-2 group-hover:text-indigo-600 transition-colors pl-1">
                      {job.title}
                    </p>

                    {/* Company */}
                    <p className="text-xs font-medium text-slate-400 mt-1 pl-1 truncate select-none">
                      {job.company}
                    </p>

                    {/* Match Indicator */}
                    {job.matchPercent !== undefined && (
                      <div className="mt-3 pl-1 flex items-center gap-2 select-none">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              job.matchPercent >= 75 ? 'bg-emerald-500' :
                              job.matchPercent >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                            }`}
                            style={{ width: `${job.matchPercent}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-bold tabular-nums tracking-tight ${
                          job.matchPercent >= 75 ? 'text-emerald-600' :
                          job.matchPercent >= 50 ? 'text-amber-600' : 'text-rose-500'
                        }`}>
                          {job.matchPercent}%
                        </span>
                      </div>
                    )}

                    {/* Location Tag */}
                    {job.location && (
                      <div className="mt-2.5 pl-1 flex items-center gap-1.5 select-none">
                        <span className="text-[10px] text-slate-300">📍</span>
                        <span className="text-[11px] font-medium text-slate-400 truncate">{job.location}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
