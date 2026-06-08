import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileUpload } from '@/hooks/useFileUpload';

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears uploading immediately on success while progress lingers', async () => {
    const deferred = createDeferred<{ id: string }>();
    const uploader = vi.fn(() => deferred.promise);
    const file = new File(['x'], 'cv.pdf', { type: 'application/pdf' });

    const { result } = renderHook(() => useFileUpload({ uploader }));

    act(() => {
      void result.current.upload(file);
    });
    expect(result.current.uploading).toBe(true);

    await act(async () => {
      deferred.resolve({ id: '1' });
      await deferred.promise;
    });

    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(100);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.progress).toBeNull();
  });

  it('abort then immediate re-upload does not cancel the second upload', async () => {
    vi.useRealTimers();
    const first = createDeferred<{ id: string }>();
    const second = createDeferred<{ id: string }>();
    const uploader = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const file = new File(['x'], 'cv.pdf', { type: 'application/pdf' });

    const { result } = renderHook(() => useFileUpload({ uploader }));

    act(() => {
      void result.current.upload(file);
    });

    act(() => {
      result.current.abort();
    });

    let secondResult: { id: string } | null = null;
    await act(async () => {
      const p = result.current.upload(file);
      second.resolve({ id: 'second' });
      secondResult = (await p) as { id: string } | null;
    });

    expect(secondResult).toEqual({ id: 'second' });
    await waitFor(() => expect(result.current.uploading).toBe(false));
    vi.useFakeTimers();
  });
});
