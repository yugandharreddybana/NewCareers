import { useEffect, useMemo, useState } from 'react';
import type { JobCard } from '@/types';
import { SkillResultModal } from '@/components/ui/SkillResultModal';

type Props = {
  open: boolean;
  jobs: JobCard[];
  onClose: () => void;
  onConfirm: (userJobIds: string[]) => void;
  minJobs?: number;
  maxJobs?: number;
};

export function CompareJobsModal({
  open,
  jobs,
  onClose,
  onConfirm,
  minJobs = 2,
  maxJobs = 5,
}: Props) {
  const eligible = useMemo(
    () => jobs.filter(j => j.userJobId && j.kanbanColumn !== 'Rejected'),
    [jobs],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const defaults = eligible.slice(0, Math.min(maxJobs, Math.max(minJobs, 2))).map(j => j.userJobId);
    setSelected(new Set(defaults));
  }, [open, eligible, maxJobs, minJobs]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxJobs) next.add(id);
      return next;
    });
  };

  const canCompare = selected.size >= minJobs;

  return (
    <SkillResultModal
      open={open}
      onClose={onClose}
      title="Compare jobs"
      subtitle={`Pick ${minJobs}–${maxJobs} roles to compare side by side`}
      testId="compare-jobs-modal"
    >
      {eligible.length < minJobs ? (
        <p className="font-body-md text-on-surface-variant py-4">
          Save at least {minJobs} jobs to your pipeline before comparing.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Select the opportunities you want compared on score, compensation, pros/cons, and recommendation.
          </p>
          <ul className="max-h-[min(360px,50vh)] overflow-y-auto divide-y divide-outline-variant/40 rounded-xl border border-outline-variant">
            {eligible.map(job => {
              const checked = selected.has(job.userJobId);
              return (
                <li key={job.userJobId}>
                  <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container-low transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(job.userJobId)}
                      className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-label-md text-label-md text-on-surface truncate">
                        {job.title}
                      </span>
                      <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                        {job.company} · {job.location}
                      </span>
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {job.matchPercent ?? 0}% match
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {selected.size} selected (max {maxJobs})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canCompare}
                onClick={() => onConfirm([...selected])}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary/90 disabled:opacity-50"
              >
                Compare selected
              </button>
            </div>
          </div>
        </div>
      )}
    </SkillResultModal>
  );
}
