import { test, expect } from '@playwright/test';
import {
  TEST_USER,
  submitAuthForm,
  fillOtpCode,
  goToForgotPasswordVerifyStep,
} from './helpers/auth';
import {
  requireLiveStack,
  ensureTestUser,
  clearAuthState,
  E2E_API_URL,
} from './helpers/stack';

test.describe('Forgot password — email step', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/forgot-password');
  });

  test('page shows reset copy and email field', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('link', { name: /back to sign in/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  test('submit button disabled when email empty', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await page.locator('#email').fill(TEST_USER.email);
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('email advances to verify step (enumeration-safe)', async ({ page }) => {
    await page.locator('#email').fill(TEST_USER.email);
    await submitAuthForm(page);

    await expect(page.getByRole('group', { name: /verification code/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/enter the code we sent to/i)).toBeVisible();
  });

  test('registered email advances to OTP step', async ({ page, request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);

    await page.locator('#email').fill(TEST_USER.email);
    await submitAuthForm(page);

    await expect(page.getByText(new RegExp(TEST_USER.email, 'i'))).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('group', { name: /verification code/i })).toBeVisible();
  });
});

test.describe('Forgot password — verify step validation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await goToForgotPasswordVerifyStep(page, TEST_USER.email);
  });

  test('rejects incomplete OTP', async ({ page }) => {
    await fillOtpCode(page, '123');
    await page.locator('#new-password').fill(TEST_USER.password);
    await page.locator('#confirm-password').fill(TEST_USER.password);
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(/8-digit/i);
  });

  test('rejects password shorter than 8 characters', async ({ page }) => {
    await fillOtpCode(page, '12345678');
    await page.locator('#new-password').fill('short');
    await page.locator('#confirm-password').fill('short');
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(/8 character/i);
  });

  test('rejects weak password', async ({ page }) => {
    await fillOtpCode(page, '12345678');
    await page.locator('#new-password').fill('alllowercase');
    await page.locator('#confirm-password').fill('alllowercase');
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(/weak|upper-case|numbers|symbols/i);
  });

  test('rejects mismatched confirm password', async ({ page }) => {
    await fillOtpCode(page, '12345678');
    await page.locator('#new-password').fill(TEST_USER.password);
    await page.locator('#confirm-password').fill('NotTest@9999');
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(/do not match/i);
  });

  test('shows resend cooldown after sending code', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /resend code in \d+s/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('use a different email returns to email step', async ({ page }) => {
    await page.getByRole('button', { name: /use a different email/i }).click();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('group', { name: /verification code/i })).toHaveCount(0);
  });

  test('OTP paste fills all digit inputs', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => navigator.clipboard.writeText('48291700'));
    const first = page.getByRole('textbox', { name: 'Digit 1' });
    await first.focus();
    await first.press('ControlOrMeta+V');
    for (let i = 1; i <= 8; i++) {
      await expect(page.getByRole('textbox', { name: `Digit ${i}` })).toHaveValue(/\d/);
    }
  });

  test('password visibility toggle on new password field', async ({ page }) => {
    await page.locator('#new-password').fill(TEST_USER.password);
    await expect(page.locator('#new-password')).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(page.locator('#new-password')).toHaveAttribute('type', 'text');
  });
});

test.describe('Forgot password — live API errors', () => {
  test.beforeEach(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test('invalid OTP from API shows error alert', async ({ page }) => {
    await goToForgotPasswordVerifyStep(page, TEST_USER.email);

    await fillOtpCode(page, '00000000');
    await page.locator('#new-password').fill('NotTest@9999');
    await page.locator('#confirm-password').fill('NotTest@9999');
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(/invalid otp|otp|code/i, {
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
  });
});

test.describe('Forgot password — success UI', () => {
  test('successful reset shows done step with sign-in link', async ({ page }) => {
    await goToForgotPasswordVerifyStep(page, TEST_USER.email);

    await page.route('**/api/v1/auth/reset-password', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await fillOtpCode(page, '12345678');
    await page.locator('#new-password').fill(TEST_USER.password);
    await page.locator('#confirm-password').fill(TEST_USER.password);
    await submitAuthForm(page);

    await expect(page.getByRole('heading', { name: /password updated/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login');
  });
});

test.describe('Forgot password — API contract', () => {
  test('forgot-password returns 202 envelope', async ({ request }) => {
    await requireLiveStack(request);
    const r = await request.post(`${E2E_API_URL}/auth/forgot-password`, {
      data: { email: TEST_USER.email },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(r.status()).toBe(202);
    const body = (await r.json()) as { message?: string };
    expect(body.message).toMatch(/if that email exists/i);
  });
});
