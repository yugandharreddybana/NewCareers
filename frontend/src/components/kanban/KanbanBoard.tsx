import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useKanbanPatchMutation } from '@/hooks/queries';
import type { JobCard, KanbanColumn } from '@/types';
import { formatPulledAt } from '@/lib/utils';
import { JobSourceBadge } from '@/components/ui/JobSourceBadge';
import AppliedCvModal from './AppliedCvModal';
import toast from 'react-hot-toast';

/** Saved jobs appear in Discovered with a bookmark badge — not a separate column. */
const DISPLAY_COLUMNS: KanbanColumn[] = ['Discovered', 'Applied', 'Interview', 'Offer', 'Rejected'];

const COLUMN_META: Record<KanbanColumn, { label: string; dot: string }> = {
  Applied: { label: 'Applied', dot: 'bg-primary' },
  Interview: { label: 'Interviewing', dot: 'bg-secondary' },
  Offer: { label: 'Offer', dot: 'bg-primary-container' },
  Discovered: { label: 'Discovered', dot: 'bg-outline' },
  Saved: { label: 'Discovered', dot: 'bg-outline' },
  Rejected: { label: 'Archived', dot: 'bg-outline' },
};

function isDiscoveryColumn(col: KanbanColumn): boolean {
  return col === 'Discovered' || col === 'Saved';
}

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

function getCardInitial(company: string): string {
  const trimmed = company.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'J';
}

function timeAgoLabel(iso?: string): string {
  return formatPulledAt(iso);
}

export const KanbanBoard: React.FC<Props> = ({ jobs: initialJobs, onJobClick, onColumnChange }) => {
  const [jobs, setJobs] = useState<JobCard[]>(initialJobs);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [overCol, setOverCol] = useState<KanbanColumn | null>(null);
  const [cvModal, setCvModal] = useState<{ userJobId: string; jobTitle: string } | null>(null);
  const patchInFlight = useRef<Set<string>>(new Set());
  const moveJobMutation = useKanbanPatchMutation();

  useEffect(() => { setJobs(initialJobs); }, [initialJobs]);

  const byColumn = useCallback((col: KanbanColumn) => {
    if (col === 'Discovered') {
      return jobs.filter(j => j.kanbanColumn === 'Discovered' || j.kanbanColumn === 'Saved');
    }
    return jobs.filter(j => j.kanbanColumn === col);
  }, [jobs]);

  const runMove = {
    mutate: ({ job, sourceCol, targetCol }: MoveJobPayload) => {
      patchInFlight.current.add(job.userJobId);
      setJobs(prev => prev.map(item =>
        item.userJobId === job.userJobId ? { ...item, kanbanColumn: targetCol } : item,
      ));

      if (targetCol === 'Applied') {
        setCvModal({ userJobId: job.userJobId, jobTitle: job.title });
      }

      moveJobMutation.mutate(
        { userJobId: job.userJobId, body: { kanbanColumn: targetCol } },
        {
          onSuccess: () => onColumnChange?.(job, targetCol),
          onError: () => {
            setJobs(prev => prev.map(item =>
              item.userJobId === job.userJobId ? { ...item, kanbanColumn: sourceCol } : item,
            ));
            toast.error('Failed to move card. Please try again.');
          },
          onSettled: () => {
            patchInFlight.current.delete(job.userJobId);
          },
        },
      );
    },
  };

  const handleDragStart = (e: React.DragEvent, job: JobCard) => {
    setDragging({ jobId: job.userJobId, sourceCol: job.kanbanColumn });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetCol: KanbanColumn) => {
    e.preventDefault();
    if (!dragging) { setDragging(null); setOverCol(null); return; }
    const sameDiscoveryBucket =
      isDiscoveryColumn(dragging.sourceCol) && targetCol === 'Discovered';
    if (dragging.sourceCol === targetCol || sameDiscoveryBucket) {
      setDragging(null);
      setOverCol(null);
      return;
    }

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

    runMove.mutate({ job, sourceCol, targetCol });
  };

  return (
    <>
      <div className="flex flex-1 w-full h-full min-h-0 max-lg:overflow-x-auto max-lg:scrollbar-thin select-none items-stretch">
        {DISPLAY_COLUMNS.map((col, index) => {
          const meta = COLUMN_META[col];
          const colJobs = byColumn(col);
          const isOver = overCol === col;

          return (
            <div
              key={col}
              className={`
                relative flex flex-col gap-4 transition-all px-3
                flex-1 min-w-0 min-h-full
                max-lg:min-w-[280px] max-lg:max-w-[320px] max-lg:flex-none max-lg:min-h-0
                ${isOver ? 'scale-[1.01]' : ''}
              `}
              onDragOver={e => { e.preventDefault(); setOverCol(col); }}
              onDragLeave={() => setOverCol(null)}
              onDrop={e => handleDrop(e, col)}
            >
              {index < DISPLAY_COLUMNS.length - 1 && (
                <span
                  className="pointer-events-none absolute right-0 top-0 bottom-0 w-px bg-outline-variant/70"
                  aria-hidden
                />
              )}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{meta.label}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-full font-label-sm text-label-sm">
                    {colJobs.length}
                  </span>
                  <button
                    type="button"
                    className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors"
                  >
                    more_horiz
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 flex-1 min-h-0">
                {colJobs.length === 0 && col === 'Offer' && (
                  <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low">
                    <span className="material-symbols-outlined text-outline mb-2 text-[32px]">celebration</span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-center px-8">
                      No offers yet. Keep momentum high!
                    </p>
                  </div>
                )}
                {colJobs.length === 0 && col !== 'Offer' && (
                  <div className={`flex flex-col items-center justify-center h-36 border-2 border-dashed rounded-xl bg-surface-container-low transition-colors ${isOver ? 'border-primary' : 'border-outline-variant'}`}>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Drag jobs here</p>
                  </div>
                )}
                {colJobs.map(job => (
                  <div
                    key={job.userJobId}
                    draggable
                    onDragStart={e => handleDragStart(e, job)}
                    onClick={() => onJobClick?.(job)}
                    className={[
                      'bg-surface-container-lowest p-gutter rounded-xl border border-outline-variant',
                      'shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all',
                      'cursor-grab active:cursor-grabbing',
                      'hover:-translate-y-[2px] hover:border-primary',
                      'select-none relative',
                      col === 'Interview' ? 'border-l-4 border-l-primary' : '',
                    ].join(' ')}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary-fixed border border-outline-variant flex items-center justify-center text-[11px] font-bold text-on-secondary-fixed-variant">
                        {getCardInitial(job.company)}
                      </div>
                      {job.matchPercent !== undefined && (
                        <span className="text-primary bg-primary-fixed text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
                          {job.matchPercent}% Match
                        </span>
                      )}
                    </div>
                    <h4 className="font-headline-sm text-[16px] text-on-surface mb-1 line-clamp-2">{job.title}</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mb-2 truncate">
                      {job.company}{job.location ? ` • ${job.location}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {job.kanbanColumn === 'Saved' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary-container">
                          Saved
                        </span>
                      )}
                      {job.sourceName ? <JobSourceBadge name={job.sourceName} /> : null}
                    </div>
                    {col === 'Interview' && (
                      <div className="bg-surface-container p-2 rounded-lg mb-4">
                        <div className="flex items-center gap-2 text-primary">
                          <span className="material-symbols-outlined text-[18px]">event</span>
                          <span className="font-label-sm text-label-sm font-bold">Interview: Scheduled</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        {timeAgoLabel(job.deliveredAt ?? job.postedAt)}
                      </span>
                    </div>
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
