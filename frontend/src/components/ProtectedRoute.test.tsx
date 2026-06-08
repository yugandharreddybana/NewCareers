import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/components/ProtectedRoute';

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
