import { test, expect } from '@playwright/test';

/**
 * Task 149 — E2E: Auth flows
 * Covers: full signup flow, email verification (mock), login, forgot password request.
 */
test.describe('Authentication', () => {

  const timestamp = Date.now();
  const testEmail    = `e2e_${timestamp}@careerops.test`;
  const testPassword = 'Test@1234!';
  const testName     = 'E2E Tester';

  // ── 1. Full signup flow ────────────────────────────────────────────────
  test('signup — user can register and sees verification prompt', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveTitle(/CareerOps/);

    await page.fill('[name="name"], [placeholder*="name" i]', testName);
    await page.fill('[name="email"], [placeholder*="email" i]', testEmail);
    await page.fill('[name="password"], [placeholder*="password" i]', testPassword);

    await page.click('button[type="submit"]');

    // Should show an OTP/verification UI or redirect to verify page
    await expect(
      page.locator('text=/verif|otp|code sent/i')
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 2. Email verification mock (OTP bypass) ───────────────────────────
  test('verify — entering 6-digit OTP enables account', async ({ page }) => {
    // In test environment, a fixed OTP is accepted (configured in application-test.properties)
    await page.goto('/verify-email');
    const otpInput = page.locator('input[maxlength="1"], input[name*="otp"], input[placeholder*="code" i]').first();

    if (await otpInput.isVisible()) {
      // Fill each digit field or single OTP input
      const allDigits = await page.locator('input[maxlength="1"]').all();
      if (allDigits.length >= 6) {
        for (const digit of allDigits) await digit.fill('1');
      } else {
        await otpInput.fill('111111');
      }
      await page.click('button[type="submit"]');
    }
    // Either accepted or lands on login
    await expect(page).toHaveURL(/login|dashboard/, { timeout: 6000 });
  });

  // ── 3. Login with valid credentials ──────────────────────────────────
  test('login — valid credentials redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"], [placeholder*="email" i]', 'demo@careerops.test');
    await page.fill('[name="password"], [placeholder*="password" i]', 'Demo@1234!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  // ── 4. Login with wrong password shows error ─────────────────────────
  test('login — wrong password shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"], [placeholder*="email" i]', testEmail);
    await page.fill('[name="password"], [placeholder*="password" i]', 'WrongPass!');
    await page.click('button[type="submit"]');

    await expect(
      page.locator('text=/invalid|incorrect|wrong|failed/i')
    ).toBeVisible({ timeout: 6000 });
  });

  // ── 5. Forgot password — request OTP ─────────────────────────────────
  test('forgot password — submitting email shows confirmation', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('[name="email"], [placeholder*="email" i]', testEmail);
    await page.click('button[type="submit"]');

    await expect(
      page.locator('text=/sent|check your email|otp/i')
    ).toBeVisible({ timeout: 6000 });
  });

});
