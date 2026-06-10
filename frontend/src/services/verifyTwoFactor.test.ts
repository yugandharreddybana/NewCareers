import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { authApi } from './api';
import { server } from '@/test/server';
import { MOCK_USER } from '@/test/fixtures';

const API_ROOT = '*/api/v1';

describe('authApi.verifyTwoFactor', () => {
  it('sends rememberMe in the request body when enabled', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API_ROOT}/auth/two-factor/verify`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          user: structuredClone(MOCK_USER),
          token: 'test-access-token',
        });
      }),
    );

    await authApi.verifyTwoFactor('challenge-token', '123456', true);

    expect(capturedBody).toMatchObject({
      challengeToken: 'challenge-token',
      code: '123456',
      rememberMe: true,
    });
  });
});
