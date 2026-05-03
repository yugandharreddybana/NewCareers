/**
 * useAsync — generic hook for async operations with loading/error/data state
 *
 * B5 fix: every page was reimplementing the same pattern:
 *   const [data, setData] = useState(null);
 *   const [loading, setLoading] = useState(false);
 *   const [error, setError] = useState(null);
 *   useEffect(() => { setLoading(true); api.call().then(setData).catch(setError).finally(() => setLoading(false)) }, []);
 *
 * useAsync centralises this into one well-tested hook with:
 *  - Stale response protection (ignores results from superseded calls)
 *  - Manual re-trigger via execute()
 *  - Optional immediate execution on mount
 *  - Typed generics
 *
 * Usage:
 *   const { data, loading, error, execute } = useAsync(progressApi.getFull, { immediate: true });
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** Manually trigger the async function, optionally with new args */
  execute: (...args: unknown[]) => Promise<T | null>;
}

interface UseAsyncOptions {
  /** If true, calls the function immediately on mount (default: true) */
  immediate?: boolean;
}

/**
 * @param fn   The async function to manage. Should return a Promise<T>.
 * @param opts Options: { immediate = true }
 */
export function useAsync<T>(
  fn: (...args: unknown[]) => Promise<T>,
  opts: UseAsyncOptions = {},
): AsyncState<T> {
  const { immediate = true } = opts;

  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError]     = useState<Error | null>(null);

  // Track the latest call so stale responses are ignored
  const callId = useRef(0);

  const execute = useCallback(async (...args: unknown[]): Promise<T | null> => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      if (id === callId.current) setData(result);
      return result;
    } catch (e: unknown) {
      if (id === callId.current) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
      }
      return null;
    } finally {
      if (id === callId.current) setLoading(false);
    }
  }, [fn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) execute();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, execute };
}

export default useAsync;
