import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/context/authCtx';

const mocks = vi.hoisted(() => ({
  logout: vi.fn().mockResolvedValue({ success: true }),
  clearPendingGoogleConsents: vi.fn(),
  clearPendingGoogleLink: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  authApi: {
    logout: mocks.logout,
    me: vi.fn(),
  },
  profileApi: { update: vi.fn() },
  ensureFreshSession: vi.fn(),
  AUTH_REFRESHED_EVENT: 'co:auth:refreshed',
  AUTH_LOGGED_OUT_EVENT: 'co:auth:logged-out',
  shouldSkipInitialSessionProbe: vi.fn(() => true),
}));

vi.mock('@/lib/pendingGoogleConsents', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/pendingGoogleConsents')>();
  return {
    ...actual,
    clearPendingGoogleConsents: mocks.clearPendingGoogleConsents,
  };
});

vi.mock('@/lib/pendingGoogleLink', () => ({
  clearPendingGoogleLink: mocks.clearPendingGoogleLink,
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: { clear: vi.fn(), removeQueries: vi.fn(), setQueryData: vi.fn() },
}));

vi.mock('@/hooks/queries/useJobs', () => ({
  invalidatePipelineAfterProfileChange: vi.fn(),
  resetPipelineSkillsSync: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears pending Google state on sign out', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mocks.logout).toHaveBeenCalled();
    expect(mocks.clearPendingGoogleConsents).toHaveBeenCalled();
    expect(mocks.clearPendingGoogleLink).toHaveBeenCalled();
  });
});
