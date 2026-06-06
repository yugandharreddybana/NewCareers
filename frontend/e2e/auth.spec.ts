/**
 * Auth smoke suite — quick health check. Full coverage lives in:
 *   auth-branding.spec.ts
 *   auth-login.spec.ts
 *   auth-signup-login.spec.ts
 *   auth-signup-full.spec.ts
 *   auth-forgot-password.spec.ts
 *   auth-remember-me.spec.ts
 *   auth-captcha.spec.ts
 *   auth-route-guards.spec.ts
 *   auth-logout.spec.ts
 */
import { test, expect } from '@playwright/test';
import {
  TEST_USER,
  fillSignupForm,
  fillLoginForm,
  submitAuthForm,
} from './helpers/auth';
import {
  requireLiveStack,
  ensureTestUser,
  deleteTestUser,
  clearAuthState,
} from './helpers/stack';

test.afterAll(async ({ request }) => {
  await deleteTestUser(request);
});

test.describe('Authentication (smoke)', () => {
  test('signup via /register reaches onboarding', async ({ page, request }) => {
    await requireLiveStack(request);
    await deleteTestUser(request);
    await clearAuthState(page);

    await page.goto('/register');
    await expect(page).toHaveURL(/\/signup/);
    await fillSignupForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  });

  test('login wrong password shows alert', async ({ page, request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);

    await clearAuthState(page);
    await page.goto('/login');
    await fillLoginForm(page, { email: TEST_USER.email, password: 'WrongPass1!' });
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(
      /invalid|incorrect|wrong|failed|credentials/i,
      { timeout: 10_000 },
    );
  });

  test('forgot password email step advances to OTP', async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/forgot-password');
    await page.locator('#email').fill(TEST_USER.email);
    await submitAuthForm(page);
    await expect(page.getByRole('group', { name: /verification code/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('login shows session-expired banner and remember me', async ({ page }) => {
    await page.goto('/login?reason=session_expired');
    await expect(page.getByText(/session expired/i)).toBeVisible();
    await page.goto('/login');
    await expect(page.getByRole('checkbox', { name: /keep me signed in/i })).toBeVisible();
  });
});
