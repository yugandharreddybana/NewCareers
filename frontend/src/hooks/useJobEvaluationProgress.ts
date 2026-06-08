import { useState, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SourceProgress {
  source: string;
  jobsFound: number;
  status: 'waiting' | 'scanning' | 'done';
  icon: string;
}

export interface EvaluationProgress {
  sources: SourceProgress[];
  evaluated: number;
  total: number;
  status: 'idle' | 'connecting' | 'scraping' | 'evaluating' | 'complete' | 'error';
  message: string;
  errorMessage?: string;
}

interface SseEvent {
  status: 'SOURCE_FOUND' | 'JOB_EVALUATED' | 'COMPLETE';
  source?: string;
  count?: number;
  evaluated?: number;
  total?: number;
  message?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const KNOWN_SOURCES = [
  { source: 'IrishJobs', icon: '🇮🇪' },
  { source: 'LinkedIn', icon: '💼' },
  { source: 'Indeed', icon: '🔍' },
  { source: 'Adzuna', icon: '📊' },
  { source: 'Jobs.ie', icon: '🏢' },
  { source: 'JobsIreland', icon: '☘️' },
];

const initialSources = (): SourceProgress[] =>
  KNOWN_SOURCES.map(s => ({ ...s, jobsFound: 0, status: 'waiting' as const }));

const initialState = (): EvaluationProgress => ({
  sources: initialSources(),
  evaluated: 0,
  total: 0,
  status: 'idle',
  message: 'Preparing your job search…',
});

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Manages a Server-Sent Events connection to /api/jobs/evaluation-progress.
 *
 * Usage:
 *   const { progress, connect, disconnect } = useJobEvaluationProgress(userId);
 *
 *   // Open the stream BEFORE calling the onboarding start API:
 *   connect();
 *   await api.startOnboardingDelivery();
 *
 *   // progress.status === 'complete' triggers auto-redirect to dashboard
 */
export function useJobEvaluationProgress(userId: string | null | undefined) {
  const [progress, setProgress] = useState<EvaluationProgress>(initialState());
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback((overrideUserId?: string) => {
    const id = overrideUserId ?? userId;
    if (!id) return;
    disconnect(); // clean up any previous connection

    const apiBase = (import.meta as any).env?.VITE_API_URL ?? '';
    const url = `${apiBase}/api/jobs/evaluation-progress?userId=${encodeURIComponent(id)}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    setProgress(prev => ({
      ...prev,
      status: 'connecting',
      message: 'Connecting to job search engine…',
    }));

    es.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data: SseEvent = JSON.parse(e.data);

        if (data.status === 'COMPLETE') {
          setProgress(prev => ({
            ...prev,
            status: 'complete',
            evaluated: data.evaluated ?? prev.evaluated,
            total: data.total ?? prev.total,
            message: data.message ?? 'All jobs evaluated — loading your dashboard…',
          }));
          disconnect();
          return;
        }

        setProgress(prev => {
          if (data.status === 'SOURCE_FOUND' && data.source) {
            const updatedSources = prev.sources.map(s =>
              s.source.toLowerCase() === data.source!.toLowerCase()
                ? { ...s, jobsFound: data.count ?? 0, status: 'done' as const }
                : s
            );
            // If source not in our known list, append it dynamically
            const known = updatedSources.some(
              s => s.source.toLowerCase() === data.source!.toLowerCase()
            );
            const finalSources = known
              ? updatedSources
              : [...updatedSources, {
                  source: data.source!,
                  icon: '📋',
                  jobsFound: data.count ?? 0,
                  status: 'done' as const,
                }];
            return {
              ...prev,
              sources: finalSources,
              total: data.total ?? prev.total,
              status: 'scraping',
              message: `${data.source}: found ${data.count ?? 0} matching jobs`,
            };
          }

          if (data.status === 'JOB_EVALUATED') {
            return {
              ...prev,
              evaluated: data.evaluated ?? prev.evaluated + 1,
              total: data.total ?? prev.total,
              status: 'evaluating',
              message: `Evaluating jobs… ${data.evaluated ?? prev.evaluated + 1}${
                data.total ? ' / ' + data.total : ''
              }`,
            };
          }

          return prev;
        });
      } catch (err) {
        // Malformed JSON from server — ignore single event
      }
    });

    es.onerror = () => {
      setProgress(prev => ({
        ...prev,
        status: prev.status === 'complete' ? 'complete' : 'error',
        errorMessage: 'Lost connection to job search engine.',
      }));
      es.close();
    };
  }, [userId, disconnect]);

  const reset = useCallback(() => {
    disconnect();
    setProgress(initialState());
  }, [disconnect]);

  const progressPercent =
    progress.total > 0 ? Math.round((progress.evaluated / progress.total) * 100) : 0;

  return { progress, progressPercent, connect, disconnect, reset };
}
