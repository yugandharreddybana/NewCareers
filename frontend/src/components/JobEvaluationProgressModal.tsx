import React from 'react';
import { EvaluationProgress } from '../hooks/useJobEvaluationProgress';

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  progress: EvaluationProgress;
  progressPercent: number;
  /** Called when user manually closes (only possible on error state) */
  onClose?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Full-screen overlay shown after "Complete Profile" is clicked.
 *
 * Displays:
 *   - Per-source cards (IrishJobs, LinkedIn, Indeed, etc.) showing found job counts
 *   - An overall progress bar as jobs are evaluated against the user's profile
 *   - A completion message with auto-redirect indication
 *
 * The modal cannot be dismissed during evaluation (intentional UX).
 * On error, a close button and retry message are shown.
 */
export const JobEvaluationProgressModal: React.FC<Props> = ({
  progress,
  progressPercent,
  onClose,
}) => {
  const isComplete = progress.status === 'complete';
  const isError = progress.status === 'error';
  const isEvaluating = progress.status === 'evaluating';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 border border-gray-200 dark:border-gray-700">

        {/* ── Header ── */}
        <div className="mb-6 text-center">
          {isComplete ? (
            <div className="text-4xl mb-2">✅</div>
          ) : isError ? (
            <div className="text-4xl mb-2">⚠️</div>
          ) : (
            <div className="text-4xl mb-2 animate-pulse">🔍</div>
          )}
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isComplete
              ? 'Jobs Ready!'
              : isError
              ? 'Something went wrong'
              : 'Finding Your Best Matches'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 min-h-[1.25rem]">
            {progress.message}
          </p>
        </div>

        {/* ── Per-source breakdown ── */}
        <div className="space-y-2 mb-6">
          {progress.sources.map(src => (
            <div
              key={src.source}
              className={`flex items-center justify-between p-3 rounded-xl transition-all duration-300 ${
                src.status === 'done'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : src.status === 'scanning'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{src.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {src.source}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {src.status === 'waiting' && (
                  <span className="text-xs text-gray-400">Waiting…</span>
                )}
                {src.status === 'scanning' && (
                  <>
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-blue-600 dark:text-blue-400">Scanning…</span>
                  </>
                )}
                {src.status === 'done' && (
                  <>
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                      {src.jobsFound} jobs found
                    </span>
                    <span className="text-green-600 text-sm">✓</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Evaluation progress bar ── */}
        {(isEvaluating || isComplete || progress.total > 0) && (
          <div className="mb-5">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
              <span>Evaluating jobs against your profile</span>
              <span className="font-medium">
                {progress.evaluated}{progress.total > 0 ? ` / ${progress.total}` : ''}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: isComplete
                    ? '#16a34a'
                    : 'linear-gradient(90deg, #0d9488, #2563eb)',
                }}
              />
            </div>
          </div>
        )}

        {/* ── Complete state ── */}
        {isComplete && (
          <div className="text-center">
            <p className="text-sm font-medium text-teal-600 dark:text-teal-400 animate-pulse">
              Loading your dashboard…
            </p>
          </div>
        )}

        {/* ── Error state ── */}
        {isError && (
          <div className="text-center space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              {progress.errorMessage ?? 'Connection lost. Your jobs may still be processing.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You can check your dashboard — jobs found so far will appear there.
            </p>
            {onClose && (
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobEvaluationProgressModal;
