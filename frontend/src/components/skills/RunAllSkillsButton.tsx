import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { skillsApi } from '../../services/skillsApi';
import type { RunAllSkillsBatchStatus, RunAllSkillsResponse, SkillRunResponse } from '../../types/skills';

const POLL_INTERVAL_MS = 3_000;

interface Props {
  userJobId: string;
  onComplete?: (results: RunAllSkillsResponse) => void;
}

/**
 * Button that runs all 9 CareerOps skills for a job in one click.
 * Shows live progress count and a Download All PDF button on completion.
 */
export function RunAllSkillsButton({ userJobId, onComplete }: Props) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'done' | 'error'>('idle');
  const [batch, setBatch] = useState<RunAllSkillsBatchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => clearPollTimer, []);

  const toLegacyRunAllResponse = (nextBatch: RunAllSkillsBatchStatus): RunAllSkillsResponse => {
    const skillResponses = Object.values(nextBatch.results);
    const succeeded = skillResponses.filter((response): response is SkillRunResponse => response.type === 'RESULT').length;
    const pendingAnswers = skillResponses.filter(response => response.type === 'QUESTION').length;
    const failed = Math.max(0, nextBatch.total - succeeded - pendingAnswers);

    return {
      total: nextBatch.total,
      succeeded,
      failed,
      pendingAnswers,
      results: nextBatch.results,
    };
  };

  const pollBatchStatus = async (batchId: string) => {
    try {
      const nextBatch = await skillsApi.getRunAllStatus(batchId);
      setBatch(nextBatch);

      if (nextBatch.status === 'completed') {
        clearPollTimer();
        setStatus('done');
        onComplete?.(toLegacyRunAllResponse(nextBatch));
        return;
      }

      if (nextBatch.status === 'failed') {
        clearPollTimer();
        setStatus('error');
        setError('Run All stopped before it finished. Please try again.');
        return;
      }

      pollTimerRef.current = setTimeout(() => {
        void pollBatchStatus(batchId);
      }, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      clearPollTimer();
      const msg = (err as { normalizedMessage?: string })?.normalizedMessage
        || 'Run All status could not be refreshed. Please try again.';
      setError(msg);
      setStatus('error');
    }
  };

  const handleRunAll = async () => {
    clearPollTimer();
    setStatus('starting');
    setError(null);
    setBatch(null);
    try {
      const nextBatch = await skillsApi.runAllAsync(userJobId);
      setBatch(nextBatch);

      if (nextBatch.status === 'completed') {
        setStatus('done');
        onComplete?.(toLegacyRunAllResponse(nextBatch));
        return;
      }

      setStatus('running');
      pollTimerRef.current = setTimeout(() => {
        void pollBatchStatus(nextBatch.id);
      }, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      const msg = (err as { normalizedMessage?: string })?.normalizedMessage
        || 'Run All could not be started. Please try again.';
      setError(msg);
      setStatus('error');
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      await skillsApi.downloadAllPdf(userJobId);
    } catch {
      toast.error('Could not generate the combined PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const processedCount = batch?.completed ?? 0;
  const totalCount = batch?.total ?? 14;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Run All button */}
      {status !== 'done' && (
        <button
          type="button"
          onClick={handleRunAll}
          disabled={status === 'running' || status === 'starting'}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-colors shadow-sm"
        >
          {status === 'running' || status === 'starting' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {status === 'starting' ? 'Starting batch...' : 'Running all skills...'}
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Run All Skills
            </>
          )}
        </button>
      )}

      {/* Progress indicator */}
      {(status === 'running' || status === 'starting') && (
        <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          {status === 'starting'
            ? 'Preparing your skill batch...'
            : `Running skills in the background... ${processedCount}/${totalCount} finished`}
        </span>
      )}

      {/* Done state */}
      {status === 'done' && batch && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600 dark:text-green-400 font-medium">
              ✓ Background run finished. {batch.completed}/{batch.total} skills processed.
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Review the individual skill panels for detailed results and any follow-up questions.
            </span>
          </div>

          {/* Download All PDF */}
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg border border-indigo-200 dark:border-indigo-800 disabled:opacity-60 transition-colors"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download All PDF
              </>
            )}
          </button>

          {/* Re-run option */}
          <button
            type="button"
            onClick={handleRunAll}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
          >
            Re-run all
          </button>
        </>
      )}

      {/* Error state */}
      {status === 'error' && (
        <>
          <span className="text-sm text-red-500">{error}</span>
          <button
            type="button"
            onClick={handleRunAll}
            className="text-sm text-indigo-600 hover:underline"
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}

export default RunAllSkillsButton;