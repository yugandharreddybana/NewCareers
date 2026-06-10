import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { getUserFacingErrorMessage } from './userFacingError';

describe('getUserFacingErrorMessage', () => {
  it('hides raw 404 status text', () => {
    const err = new AxiosError('Request failed with status code 404');
    err.response = { status: 404, data: {}, statusText: 'Not Found', headers: {}, config: {} as never };
    expect(getUserFacingErrorMessage(err)).not.toMatch(/404/);
    expect(getUserFacingErrorMessage(err)).toContain('unavailable');
  });

  it('does not leak internal server diagnostics', () => {
    const err = {
      status: 500,
      normalizedMessage: 'NullPointerException at com.careerops.service.Foo',
    };
    expect(getUserFacingErrorMessage(err, 'Fallback')).toBe(
      'Our servers had trouble completing that request. Please try again shortly.',
    );
  });

  it('allows safe client-validation phrases', () => {
    const err = {
      status: 400,
      normalizedMessage: 'Enter the 8-digit code from your email.',
    };
    expect(getUserFacingErrorMessage(err, 'Fallback')).toBe(
      'Enter the 8-digit code from your email.',
    );
  });

  it('maps 401 to session expired guidance', () => {
    const err = { status: 401, normalizedMessage: 'Account is no longer active' };
    expect(getUserFacingErrorMessage(err)).toContain('session');
  });

  it('maps generic 403 to permission guidance instead of session expiry', () => {
    const err = { status: 403, normalizedMessage: 'Plan limit reached' };
    expect(getUserFacingErrorMessage(err)).toContain('permission');
    expect(getUserFacingErrorMessage(err)).not.toContain('session');
  });
});
