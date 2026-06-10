import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUBSCRIPTION_QUERY_KEY, useSubscription } from '@/hooks/useSubscription';

const mockGetSubscription = vi.fn();

vi.mock('@/services/billingApi', () => ({
  billingApi: {
    getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  },
}));

const mockUser = { id: 'user-1', email: 'user@example.com' };
let authUser: typeof mockUser | null = mockUser;

vi.mock('@/context/authCtx', () => ({
  useAuth: () => ({ user: authUser }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = mockUser;
  });

  it('exports stable SUBSCRIPTION_QUERY_KEY', () => {
    expect(SUBSCRIPTION_QUERY_KEY).toEqual(['subscription']);
  });

  it('does not fetch when user is absent', () => {
    authUser = null;

    const { result } = renderHook(() => useSubscription(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(mockGetSubscription).not.toHaveBeenCalled();
    expect(result.current.subscription).toBeNull();
  });

  it('ignores stale subscription cache when user is absent', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      plan: 'FREE',
      effectivePlan: 'FREE',
      status: 'ACTIVE',
      hasBillingAccount: false,
      canManageBilling: true,
      usageThisMonth: { aiRuns: 0, applications: 0 },
      limits: { aiRunsPerMonth: 5, applicationsPerMonth: 10, cvUploads: 1, teamMembers: 1 },
      cvUploadsTotal: 0,
      organizationId: 'org-1',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      daysRemaining: 0,
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result, rerender } = renderHook(() => useSubscription(), {
      wrapper: ({ children }) =>
        createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.plan).toBe('FREE'));

    authUser = null;
    rerender();

    expect(result.current.subscription).toBeNull();
  });

  it('normalizes CANCELED to CANCELLED', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      plan: 'FREE',
      effectivePlan: 'FREE',
      status: 'CANCELED',
      hasBillingAccount: false,
      canManageBilling: true,
      usageThisMonth: { aiRuns: 1, applications: 2 },
      limits: { aiRunsPerMonth: 5, applicationsPerMonth: 10, cvUploads: 1, teamMembers: 1 },
      cvUploadsTotal: 0,
      organizationId: 'org-1',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      daysRemaining: 0,
    });

    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('CANCELLED'));
    expect(result.current.plan).toBe('FREE');
  });
});
