import { test, expect } from '@playwright/test';
import {
  uniqueTestUser,
  fillSignupForm,
  fillLoginForm,
  submitAuthForm,
} from './helpers/auth';

/**
 * Legacy auth spec — aligned with current app (no email OTP gate after signup).
 * Prefer auth-signup.spec.ts for the full live-stack signup flow.
 */
test.describe('Authentication (smoke)', () => {
  test('signup via /register redirects and reaches onboarding', async ({ page }) => {
    const creds = uniqueTestUser('legacy');

    await page.goto('/register');
    await expect(page).toHaveURL(/\/signup/);

    await fillSignupForm(page, creds);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  });

  test('login — wrong password shows error message', async ({ page }) => {
    const creds = uniqueTestUser('login_fail');

    await page.goto('/signup');
    await fillSignupForm(page, creds);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });

    await page.context().clearCookies();
    await page.goto('/login');
    await fillLoginForm(page, { email: creds.email, password: 'WrongPass1!' });
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(/invalid|incorrect|wrong|failed|credentials/i, {
      timeout: 10_000,
    });
  });

  test('forgot password — submitting email shows confirmation', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('#email, [name="email"]').first().fill('nobody@careerops.test');
    await submitAuthForm(page);

    await expect(
      page.getByText(/sent|check your email|otp|if that email|verification code/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('login — session expired banner when reason=session_expired', async ({ page }) => {
    await page.goto('/login?reason=session_expired');
    await expect(page.getByText(/session expired/i)).toBeVisible();
  });

  test('login — remember me checkbox and signup link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('checkbox', { name: /remember me/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/signup');
  });
});
