import React, { useState } from 'react';
import { skillsApi } from '../../services/skillsApi';
import type { RunAllSkillsResponse } from '../../types/skills';

interface Props {
  userJobId: string;
  onComplete?: (results: RunAllSkillsResponse) => void;
}

/**
 * Button that runs all 9 CareerOps skills for a job in one click.
 * Shows live progress count and a Download All PDF button on completion.
 */
export function RunAllSkillsButton({ userJobId, onComplete }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<RunAllSkillsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleRunAll = async () => {
    setStatus('running');
    setError(null);
    try {
      const res = await skillsApi.runAll(userJobId);
      setResults(res);
      setStatus('done');
      onComplete?.(res);
    } catch (err: unknown) {
      const msg = (err as { normalizedMessage?: string })?.normalizedMessage
        || 'Run All failed. Please try again.';
      setError(msg);
      setStatus('error');
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      await skillsApi.downloadAllPdf(userJobId);
    } catch {
      /* ignore — browser handles file download errors */
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Run All button */}
      {status !== 'done' && (
        <button
          onClick={handleRunAll}
          disabled={status === 'running'}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-colors shadow-sm"
        >
          {status === 'running' ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
              </svg>
              Running all skills...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run All Skills
            </>
          )}
        </button>
      )}

      {/* Progress indicator */}
      {status === 'running' && (
        <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          Running 9 skills… this takes 60–90 seconds
        </span>
      )}

      {/* Done state */}
      {status === 'done' && results && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600 dark:text-green-400 font-medium">
              ✓ {results.succeeded}/{results.total} skills complete
            </span>
            {results.failed > 0 && (
              <span className="text-amber-500">
                ({results.failed} failed)
              </span>
            )}
          </div>

          {/* Download All PDF */}
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg border border-indigo-200 dark:border-indigo-800 disabled:opacity-60 transition-colors"
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download All PDF
              </>
            )}
          </button>

          {/* Re-run option */}
          <button
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