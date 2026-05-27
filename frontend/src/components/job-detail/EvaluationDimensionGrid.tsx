import { useState } from 'react';
import type { EvaluationDimension } from '@/lib/jobEvaluation';

type Props = {
  dimensions: EvaluationDimension[];
  legacy?: boolean;
};

function scoreTone(score: number): string {
  if (score >= 4) return 'text-emerald-700';
  if (score >= 3) return 'text-amber-700';
  return 'text-rose-700';
}

export function EvaluationDimensionGrid({ dimensions, legacy }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!dimensions.length) return null;

  return (
    <div className="job-eval-dimension-grid">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-label-md text-label-md text-on-surface">Rubric breakdown</h3>
        {legacy && (
          <span className="job-eval-legacy-badge" title="Older evaluation format — dimensions inferred from stored scores">
            Legacy format
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-outline-variant">
        <table className="job-eval-dimension-table w-full min-w-[520px] text-left text-body-sm">
          <thead>
            <tr className="bg-surface-container-high/80 text-label-sm uppercase tracking-wide text-secondary">
              <th className="px-3 py-2.5 font-semibold">Dimension</th>
              <th className="px-3 py-2.5 font-semibold text-center w-24">Score /5</th>
              <th className="px-3 py-2.5 font-semibold text-center w-20">Weight</th>
              <th className="px-3 py-2.5 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map(dim => {
              const hasReason = Boolean(dim.reason?.trim());
              const isOpen = expanded.has(dim.key);
              return (
                <tr key={dim.key} className="border-t border-outline-variant/80 hover:bg-surface-container-low/60">
                  <td className="px-3 py-2.5 font-medium text-on-surface">{dim.label}</td>
                  <td className={`px-3 py-2.5 text-center font-bold tabular-nums ${scoreTone(dim.score)}`}>
                    {dim.score.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-on-surface-variant tabular-nums">
                    {dim.weight != null ? `${Math.round(dim.weight * 100)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-on-surface-variant">
                    {hasReason ? (
                      <>
                        <button
                          type="button"
                          className="job-eval-reason-toggle lg:hidden text-primary font-label-sm"
                          onClick={() => toggle(dim.key)}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? 'Hide' : 'Show'} reason
                        </button>
                        <p
                          className={`leading-relaxed mt-1 lg:mt-0 ${isOpen ? 'block' : 'hidden lg:block'}`}
                        >
                          {dim.reason}
                        </p>
                      </>
                    ) : (
                      <span className="text-secondary italic">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
