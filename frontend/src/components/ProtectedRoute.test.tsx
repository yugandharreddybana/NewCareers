import { describe, expect, it } from 'vitest';
import { isOnboardingExemptPath, safeRedirectPath } from '@/components/ProtectedRoute';

describe('safeRedirectPath', () => {
  it('allows internal app paths', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('/jobs/abc-123')).toBe('/jobs/abc-123');
  });

  it('rejects open redirects and auth pages', () => {
    expect(safeRedirectPath('//evil.test')).toBeNull();
    expect(safeRedirectPath('/login')).toBeNull();
    expect(safeRedirectPath('/')).toBeNull();
    expect(safeRedirectPath('https://evil.test')).toBeNull();
  });
});

describe('isOnboardingExemptPath', () => {
  it('allows billing routes before onboarding completes', () => {
    expect(isOnboardingExemptPath('/account/billing')).toBe(true);
    expect(isOnboardingExemptPath('/billing/success')).toBe(true);
    expect(isOnboardingExemptPath('/billing/cancel')).toBe(true);
  });

  it('keeps other protected routes behind onboarding', () => {
    expect(isOnboardingExemptPath('/dashboard')).toBe(false);
    expect(isOnboardingExemptPath('/account/profile')).toBe(false);
  });
});
