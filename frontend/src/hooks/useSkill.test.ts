/**
 * Task 144 — useSkill hook state machine tests
 *
 * State transitions covered:
 *  ✓ idle → loading → done
 *  ✓ idle → loading → pending_answer → reply → done
 *  ✓ error state
 *  ✓ invalidateCache resets to idle
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSkill } from '@/hooks/useSkill';

// ── API mock ─────────────────────────────────────────────────────────────────
const mockStart = vi.fn();
const mockReply = vi.fn();

vi.mock('@/services/api', () => ({
  skillsApi: {
    start: (...args: any[]) => mockStart(...args),
    reply:  (...args: any[]) => mockReply(...args),
  },
}));

describe('useSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  it('starts in idle state', () => {
    const { result } = renderHook(() => useSkill('evaluate', 'job-1'));
    expect(result.current.state.status).toBe('idle');
  });

  it('transitions idle → loading → done', async () => {
    mockStart.mockResolvedValueOnce({ status: 'done', result: { summary: 'Great fit' } });

    const { result } = renderHook(() => useSkill('evaluate', 'job-1'));
    expect(result.current.state.status).toBe('idle');

    act(() => { result.current.run(); });
    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('done'));
    expect(result.current.state.result).toEqual({ summary: 'Great fit' });
  });

  it('transitions idle → loading → pending_answer → reply → done', async () => {
    // First call returns pending_answer
    mockStart.mockResolvedValueOnce({
      status: 'pending_answer',
      question: 'What is your experience with React?',
      conversationId: 'conv-123',
    });
    // Reply returns done
    mockReply.mockResolvedValueOnce({ status: 'done', result: { summary: '5 years' } });

    const { result } = renderHook(() => useSkill('evaluate', 'job-1'));

    act(() => { result.current.run(); });
    await waitFor(() => expect(result.current.state.status).toBe('pending_answer'));
    expect(result.current.state.question).toBe('What is your experience with React?');

    act(() => { result.current.reply('5 years'); });
    await waitFor(() => expect(result.current.state.status).toBe('done'));
    expect(result.current.state.result).toEqual({ summary: '5 years' });
  });

  it('transitions to error state when API throws', async () => {
    mockStart.mockRejectedValueOnce(new Error('API down'));

    const { result } = renderHook(() => useSkill('evaluate', 'job-1'));

    act(() => { result.current.run(); });
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.error).toContain('API down');
  });

  it('invalidateCache / reset returns to idle', async () => {
    mockStart.mockResolvedValueOnce({ status: 'done', result: { summary: 'ok' } });

    const { result } = renderHook(() => useSkill('evaluate', 'job-1'));
    act(() => { result.current.run(); });
    await waitFor(() => expect(result.current.state.status).toBe('done'));

    act(() => { result.current.reset(); });
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.result).toBeUndefined();
  });
});
