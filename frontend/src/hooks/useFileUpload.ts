import { useCallback, useRef, useState } from 'react';

export interface UseFileUploadOptions<T> {
  /** Async function that performs the upload. Receives the file and an onProgress callback. */
  uploader: (file: File, onProgress: (pct: number) => void, signal?: AbortController) => Promise<T>;
  /** Called with the server response when upload succeeds. */
  onSuccess?: (result: T, file: File) => void;
  /** Called when upload fails (not from abort). */
  onError?: (err: unknown, file: File) => void;
}

export interface UseFileUploadReturn<T> {
  /** Start an upload. */
  upload: (file: File) => Promise<T | null>;
  /** Upload progress 0-100. Null when idle. */
  progress: number | null;
  /** True while an upload is in-flight. */
  uploading: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** Abort the in-flight upload. No-op if idle. */
  abort: () => void;
  /** Reset progress + error back to idle state. */
  reset: () => void;
}

/**
 * useFileUpload
 * Generic hook for tracked, abort-able file uploads.
 *
 * @example
 * const { upload, progress, uploading, error, abort } = useFileUpload({
 *   uploader: (file, onProgress) => cvApi.uploadWithProgress(file, onProgress),
 *   onSuccess: (cv) => setVersions(p => [cv, ...p]),
 *   onError: () => toast.error('Upload failed.'),
 * });
 */
export function useFileUpload<T>(options: UseFileUploadOptions<T>): UseFileUploadReturn<T> {
  const { uploader, onSuccess, onError } = options;
  const abortRef = useRef<AbortController | null>(null);

  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProgress(null);
    setUploading(false);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    reset();
  }, [reset]);

  const upload = useCallback(async (file: File): Promise<T | null> => {
    setError(null);
    setProgress(0);
    setUploading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await uploader(
        file,
        (pct: number) => setProgress(Math.round(pct)),
        controller,
      );
      setProgress(100);
      onSuccess?.(result, file);
      // Brief pause so the user sees 100% before reset
      setTimeout(reset, 800);
      return result;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        // Abort is handled by abort() already — just silently return
        return null;
      }
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setError(msg);
      setUploading(false);
      setProgress(null);
      onError?.(err, file);
      return null;
    }
  }, [uploader, onSuccess, onError, reset]);

  return { upload, progress, uploading, error, abort, reset };
}
