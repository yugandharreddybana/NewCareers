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
});
