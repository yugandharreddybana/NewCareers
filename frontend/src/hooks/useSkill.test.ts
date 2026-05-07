/**
 * Task 144 — useSkill hook state machine tests
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkill } from '@/hooks/useSkill';
import type { SkillRunResponse } from '@/types/skills';

const mockStart = vi.fn();
const mockReply = vi.fn();

vi.mock('@/services/skillsApi', () => ({
  skillsApi: {
    start: (...args: unknown[]) => mockStart(...args),
    reply: (...args: unknown[]) => mockReply(...args),
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
    expect(result.current.error).toContain('API down');
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