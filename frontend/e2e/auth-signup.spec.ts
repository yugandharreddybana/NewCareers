/**
 * Legacy headed signup smoke — full matrix lives in auth-signup-login.spec.ts.
 *
 * Run:
 *   cd frontend && npm run test:e2e:signup
 *   cd frontend && npm run test:e2e:auth:chrome
 */
import { test, expect } from '@playwright/test';
import { TEST_USER, fillSignupForm, submitAuthForm, dismissCookieBanner } from './helpers/auth';
import { requireLiveStack, deleteTestUser, clearAuthState } from './helpers/stack';

test.describe.configure({ mode: 'serial' });

test.afterAll(async ({ request }) => {
  await deleteTestUser(request);
});

test.describe('Signup smoke (live stack)', () => {
  test('happy path reaches onboarding', async ({ page, request }) => {
    await requireLiveStack(request);
    await deleteTestUser(request);
    await clearAuthState(page);
    await page.goto('/signup');
    await dismissCookieBanner(page);
    await fillSignupForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  });
});
