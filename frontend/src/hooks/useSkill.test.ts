/**
 * Task 144 — useSkill hook state machine tests
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkill } from '@/hooks/useSkill';
import type { SkillRunResponse } from '@/types/skills';

const mockStart = vi.fn();
const mockReply = vi.fn();
const mockGetLastRun = vi.fn();

vi.mock('@/services/skillsApi', () => ({
  skillsApi: {
    start: (...args: unknown[]) => mockStart(...args),
    reply: (...args: unknown[]) => mockReply(...args),
    getLastRun: (...args: unknown[]) => mockGetLastRun(...args),
    downloadSkillPdf: vi.fn(),
  },
}));

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

describe('useSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useSkill());
    expect(result.current.state).toBe('idle');
  });

  it('transitions idle to loading to done', async () => {
    const deferred = createDeferred<SkillRunResponse>();
    mockStart.mockImplementationOnce(() => deferred.promise);

    const { result } = renderHook(() => useSkill());
    expect(result.current.state).toBe('idle');

    act(() => {
      void result.current.startSkill({ skillName: 'evaluate', userJobId: 'job-1' });
    });
    expect(result.current.state).toBe('loading');

    deferred.resolve({ type: 'RESULT', skillName: 'evaluate', data: { summary: 'Great fit' } });

    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(result.current.data).toEqual({ summary: 'Great fit' });
  });

  it('transitions idle to waiting_answer to done', async () => {
    mockStart.mockResolvedValueOnce({
      type: 'QUESTION',
      question: 'What is your experience with React?',
      conversationId: 'conv-123',
    });
    mockReply.mockResolvedValueOnce({
      type: 'RESULT',
      skillName: 'evaluate',
      data: { summary: '5 years' },
    });

    const { result } = renderHook(() => useSkill());

    act(() => {
      void result.current.startSkill({ skillName: 'evaluate', userJobId: 'job-1' });
    });

    await waitFor(() => expect(result.current.state).toBe('waiting_answer'));
    expect(result.current.question).toBe('What is your experience with React?');

    act(() => {
      void result.current.handleAnswer('5 years');
    });

    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(result.current.data).toEqual({ summary: '5 years' });
  });

  it('transitions to error state when API throws', async () => {
    mockStart.mockRejectedValueOnce({ normalizedMessage: 'API down' });

    const { result } = renderHook(() => useSkill());

    act(() => {
      void result.current.startSkill({ skillName: 'evaluate', userJobId: 'job-1' });
    });

    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('Something went wrong. Please try again.');
  });

  it('loadLastRun restores cached tailor-resume run', async () => {
    mockGetLastRun.mockResolvedValueOnce({
      type: 'RESULT',
      skillName: 'tailor-resume',
      data: { summary: 'Tailored', sections: [] },
    });

    const { result } = renderHook(() => useSkill());

    let restored = false;
    await act(async () => {
      restored = await result.current.loadLastRun('job-1', 'tailor-resume');
    });

    expect(restored).toBe(true);
    expect(mockGetLastRun).toHaveBeenCalledWith('job-1', 'tailor-resume');
    expect(result.current.state).toBe('done');
    expect(result.current.data).toEqual({ summary: 'Tailored', sections: [] });
  });

  it('loadLastRun restores cached evaluate run', async () => {
    mockGetLastRun.mockResolvedValueOnce({
      type: 'RESULT',
      skillName: 'evaluate',
      data: { summary: 'cached' },
    });

    const { result } = renderHook(() => useSkill());

    let restored = false;
    await act(async () => {
      restored = await result.current.loadLastRun('job-1', 'evaluate');
    });

    expect(restored).toBe(true);
    expect(result.current.state).toBe('done');
    expect(result.current.data).toEqual({ summary: 'cached' });
  });

  it('surfaces unhandled response type in error message', async () => {
    mockStart.mockResolvedValueOnce({
      type: 'UNKNOWN' as SkillRunResponse['type'],
      skillName: 'evaluate',
    });

    const { result } = renderHook(() => useSkill());

    act(() => {
      void result.current.startSkill({ skillName: 'evaluate', userJobId: 'job-1' });
    });

    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toContain('Unhandled skill response type');
  });

  it('handleAnswer uses current conversationId after rapid state updates', async () => {
    mockStart.mockResolvedValueOnce({
      type: 'QUESTION',
      question: 'Years of experience?',
      conversationId: 'conv-stable',
    });
    const replyDeferred = createDeferred<SkillRunResponse>();
    mockReply.mockImplementationOnce(() => replyDeferred.promise);

    const { result } = renderHook(() => useSkill());

    act(() => {
      void result.current.startSkill({ skillName: 'evaluate', userJobId: 'job-1' });
    });
    await waitFor(() => expect(result.current.state).toBe('waiting_answer'));

    act(() => {
      void result.current.handleAnswer('5 years');
    });
    expect(result.current.state).toBe('loading');

    replyDeferred.resolve({
      type: 'RESULT',
      skillName: 'evaluate',
      data: { summary: 'ok' },
    });

    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(mockReply).toHaveBeenCalledWith({
      conversationId: 'conv-stable',
      answer: '5 years',
    });
  });

  it('reset returns to idle', async () => {
    mockStart.mockResolvedValueOnce({
      type: 'RESULT',
      skillName: 'evaluate',
      data: { summary: 'ok' },
    });

    const { result } = renderHook(() => useSkill());

    act(() => {
      void result.current.startSkill({ skillName: 'evaluate', userJobId: 'job-1' });
    });

    await waitFor(() => expect(result.current.state).toBe('done'));

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.data).toBeNull();
  });
});