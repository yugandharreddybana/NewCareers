import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RunAllSkillsButton from './RunAllSkillsButton';

const runAllAsync = vi.fn();
const getRunAllStatus = vi.fn();
const downloadAllPdf = vi.fn();

vi.mock('../../services/skillsApi', () => ({
  skillsApi: {
    runAllAsync: (...args: unknown[]) => runAllAsync(...args),
    getRunAllStatus: (...args: unknown[]) => getRunAllStatus(...args),
    downloadAllPdf: (...args: unknown[]) => downloadAllPdf(...args),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('RunAllSkillsButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts an async batch and polls until completion', async () => {
    runAllAsync.mockResolvedValue({
      id: 'batch-1',
      userJobId: 'job-1',
      status: 'in_progress',
      total: 14,
      completed: 0,
      createdAt: new Date().toISOString(),
      results: {},
    });
    getRunAllStatus.mockResolvedValue({
      id: 'batch-1',
      userJobId: 'job-1',
      status: 'completed',
      total: 14,
      completed: 14,
      createdAt: new Date().toISOString(),
      results: {},
    });

    render(<RunAllSkillsButton userJobId="job-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run all skills/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(runAllAsync).toHaveBeenCalledWith('job-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getRunAllStatus).toHaveBeenCalledWith('batch-1');
    expect(screen.getByText(/background run finished/i)).toBeInTheDocument();
  });
});