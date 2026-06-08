import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import toast from 'react-hot-toast';
import { useUpcoming, useJobTasks, useJobDeadlines } from './usePlanner';
import { plannerApi } from '@/services/plannerApi';

vi.mock('@/services/plannerApi', () => ({
  plannerApi: {
    getUpcoming: vi.fn(),
    getTasksForJob: vi.fn(),
    generateTasks: vi.fn(),
    completeTask: vi.fn(),
    getDeadlinesForJob: vi.fn(),
    createDeadline: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedPlannerApi = vi.mocked(plannerApi);
const mockedToast = vi.mocked(toast);

describe('usePlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads upcoming planner data', async () => {
    mockedPlannerApi.getUpcoming.mockResolvedValue({
      pendingTasks: [{ id: 'task-1', title: 'Prep', status: 'PENDING', priority: 'HIGH' }],
      upcomingEvents: [{ id: 'deadline-1', title: 'Interview', eventType: 'INTERVIEW_DATE', eventDate: '2026-05-08T12:00:00Z' }],
      overdueTasks: [],
    });

    const { result } = renderHook(() => useUpcoming());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.pendingTasks).toHaveLength(1);
    expect(result.current.data.upcomingEvents).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('falls back to empty planner data and toasts on upcoming load failure', async () => {
    mockedPlannerApi.getUpcoming.mockRejectedValue({
      response: { data: { message: 'Planner unavailable' } },
    });

    const { result } = renderHook(() => useUpcoming());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.pendingTasks).toEqual([]);
    expect(result.current.data.upcomingEvents).toEqual([]);
    expect(result.current.data.overdueTasks).toEqual([]);
    expect(result.current.error).toBe('Failed to load planner.');
    expect(mockedToast.error).toHaveBeenCalledWith('Failed to load planner.');
  });

  it('refreshes job tasks after generate and complete actions', async () => {
    mockedPlannerApi.getTasksForJob
      .mockResolvedValueOnce([{ id: 'task-1', title: 'First', status: 'PENDING', priority: 'HIGH' }])
      .mockResolvedValueOnce([{ id: 'task-1', title: 'First', status: 'PENDING', priority: 'HIGH' }, { id: 'task-2', title: 'Second', status: 'PENDING', priority: 'LOW' }])
      .mockResolvedValueOnce([{ id: 'task-2', title: 'Second', status: 'PENDING', priority: 'LOW' }]);
    mockedPlannerApi.generateTasks.mockResolvedValue(undefined as never);
    mockedPlannerApi.completeTask.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useJobTasks('job-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.tasks).toHaveLength(1);

    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.tasks).toHaveLength(2);

    await act(async () => {
      await result.current.complete('task-1');
    });
    expect(result.current.tasks).toEqual([
      expect.objectContaining({ id: 'task-2' }),
    ]);
  });

  it('adds a deadline and refreshes the job deadline list', async () => {
    mockedPlannerApi.getDeadlinesForJob
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'deadline-1', title: 'Assessment', eventType: 'CUSTOM', eventDate: '2026-05-09T09:00:00Z' }]);
    mockedPlannerApi.createDeadline.mockResolvedValue({
      id: 'deadline-1',
      title: 'Assessment',
      eventType: 'CUSTOM',
      eventDate: '2026-05-09T09:00:00Z',
    });

    const { result } = renderHook(() => useJobDeadlines('job-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.deadlines).toEqual([]);

    await act(async () => {
      await result.current.addDeadline({
        eventType: 'CUSTOM',
        title: 'Assessment',
        eventDate: '2026-05-09T09:00:00Z',
      });
    });

    expect(result.current.deadlines).toEqual([
      expect.objectContaining({ id: 'deadline-1', title: 'Assessment' }),
    ]);
  });
});