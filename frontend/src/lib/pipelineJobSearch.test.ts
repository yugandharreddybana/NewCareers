import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchJobsOrchestrated, pollPipelineJobSearch } from './pipelineJobSearch';

const deliveryStatus = vi.fn();
const jobsFetch = vi.fn();

vi.mock('@/services/api', () => ({
  onboardingApi: {
    deliveryStatus: (...args: unknown[]) => deliveryStatus(...args),
  },
  jobsApi: {
    fetch: (...args: unknown[]) => jobsFetch(...args),
  },
}));

describe('pollPipelineJobSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(pollPipelineJobSearch(undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(deliveryStatus).not.toHaveBeenCalled();
  });

  it('returns ready status from API', async () => {
    deliveryStatus.mockResolvedValueOnce({
      stage: 'ready',
      message: 'Done',
      evaluatedCount: 4,
      targetCount: 10,
      minRequired: 3,
      jobsDiscovered: 8,
      readyPartial: false,
      ready: true,
    });
    const result = await pollPipelineJobSearch();
    expect(result.ready).toBe(true);
    expect(result.evaluatedCount).toBe(4);
  });
});

describe('fetchJobsOrchestrated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns delivered count from immediate fetch when no full search', async () => {
    jobsFetch.mockResolvedValueOnce({
      delivered: 3,
      dailyCount: 3,
      dailyLimit: 25,
      remaining: 22,
      fullSearchStarted: false,
    });
    const result = await fetchJobsOrchestrated(5);
    expect(result).toEqual({ delivered: 3, fullSearch: false });
  });

  it('returns evaluatedCount after full search poll', async () => {
    jobsFetch.mockResolvedValueOnce({
      delivered: 0,
      dailyCount: 0,
      dailyLimit: 25,
      remaining: 25,
      fullSearchStarted: true,
    });
    deliveryStatus.mockResolvedValueOnce({
      stage: 'ready',
      message: 'Done',
      evaluatedCount: 7,
      targetCount: 10,
      minRequired: 3,
      jobsDiscovered: 12,
      readyPartial: false,
      ready: true,
    });
    const result = await fetchJobsOrchestrated(5);
    expect(result).toEqual({ delivered: 7, fullSearch: true });
  });
});
