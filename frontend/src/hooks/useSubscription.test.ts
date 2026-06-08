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

vi.mock('@/context/AuthContext', () => ({
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
  });

  it('normalizes CANCELED to CANCELLED and computes trialing state', async () => {
    const trialEnd = new Date(Date.now() + 5 * 86_400_000).toISOString();
    mockGetSubscription.mockResolvedValueOnce({
      plan: 'FREE',
      effectivePlan: 'PRO',
      status: 'CANCELED',
      trialEndsAt: trialEnd,
      daysRemaining: 5,
      hasBillingAccount: false,
      canManageBilling: true,
      usageThisMonth: { aiRuns: 1, applications: 2 },
      limits: { aiRunsPerMonth: 5, applicationsPerMonth: 10, cvUploads: 1, teamMembers: 1 },
      cvUploadsTotal: 0,
      organizationId: 'org-1',
      currentPeriodEnd: null,
    });

    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('CANCELLED'));
    expect(result.current.isTrialing).toBe(false);
    expect(result.current.plan).toBe('FREE');
  });

  it('marks trialing when status TRIALING and days remain', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      plan: 'FREE',
      effectivePlan: 'PRO',
      status: 'TRIALING',
      trialEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      daysRemaining: 3,
      hasBillingAccount: false,
      canManageBilling: true,
      usageThisMonth: { aiRuns: 0, applications: 0 },
      limits: { aiRunsPerMonth: 5, applicationsPerMonth: 10, cvUploads: 1, teamMembers: 1 },
      cvUploadsTotal: 0,
      organizationId: 'org-1',
      currentPeriodEnd: null,
    });

    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.isTrialing).toBe(true));
    expect(result.current.daysRemaining).toBeGreaterThan(0);
  });
});
