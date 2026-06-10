import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { NavUsagePills } from '@/components/dashboard/NavUsagePills';
import type { UsageLimits } from '@/types';

const mockLimits: UsageLimits = {
  jobDelivery: {
    key: 'job_delivery',
    label: 'Jobs Left',
    used: 3,
    limit: 25,
    remaining: 22,
    resetsAt: '2099-01-02T00:00:00.000Z',
    resetDescription: 'Resets at midnight (Europe/Dublin)',
  },
  aiTokens: {
    key: 'ai_tokens',
    label: 'AI Tokens',
    used: 120_000,
    limit: 500_000,
    remaining: 380_000,
    resetsAt: '2099-01-02T00:00:00.000Z',
    resetDescription: 'Resets at midnight (Europe/Dublin)',
  },
  skillRuns: {
    key: 'skill_runs',
    label: 'Skills Left',
    used: 2,
    limit: 200,
    remaining: 198,
    periodStart: '2099-01-01T00:00:00.000Z',
    resetsAt: '2099-01-31T00:00:00.000Z',
    resetDescription: 'Resets on billing period end',
  },
  skillApi: { label: 'AI skill requests', requestsPerMinute: 30, windowDescription: 'Per minute' },
  generalApi: { label: 'API requests', requestsPerMinute: 120, windowDescription: 'Per minute' },
  timezoneId: 'Europe/Dublin',
  planName: 'PRO',
};

vi.mock('@/hooks/queries/useUsageLimits', () => ({
  useUsageLimits: vi.fn(),
}));

import { useUsageLimits } from '@/hooks/queries/useUsageLimits';

function renderPills() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NavUsagePills />
    </QueryClientProvider>,
  );
}

describe('NavUsagePills', () => {
  it('renders jobs, tokens, and skills remaining', () => {
    vi.mocked(useUsageLimits).mockReturnValue({
      data: mockLimits,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof useUsageLimits>);

    renderPills();

    expect(screen.getByLabelText(/Jobs: 22 of 25 remaining/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tokens: 380k of 500k remaining/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Skills: 198 of 200 remaining/)).toBeInTheDocument();
  });

  it('shows retry when skillRuns is missing from API (stale backend)', () => {
    vi.mocked(useUsageLimits).mockReturnValue({
      data: {
        ...mockLimits,
        skillRuns: undefined as unknown as typeof mockLimits.skillRuns,
      },
      isError: true,
      isLoading: false,
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof useUsageLimits>);

    renderPills();

    expect(screen.getByText('Usage unavailable')).toBeInTheDocument();
  });

  it('shows retry when usage is unavailable', () => {
    vi.mocked(useUsageLimits).mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof useUsageLimits>);

    renderPills();

    expect(screen.getByText('Usage unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
