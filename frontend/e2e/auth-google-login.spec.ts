/**
 * Google login consent + BFF forwarding (H-14, N-1).
 *
 * H-14: Consent sheet UI on /login when terms not yet collected.
 * N-1: Middleware forwards `consents` body to Java on POST /auth/google.
 *
 * Run: cd frontend && npx playwright test auth-google-login.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from './helpers/auth';
import { clearAuthState, E2E_API_URL, requireLiveStack } from './helpers/stack';

const API_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' };

test.describe('H-14 — Google consent sheet (UI)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/login?e2e=google-consent');
    await dismissCookieBanner(page);
  });

  test('consent sheet shows terms, optional consents, and submit', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: /finish setting up your account/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /finish setting up your account/i })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /terms of service/i })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /ai processing/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('terms checkbox required before submit', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /continue with google/i }).click();
    await expect(dialog.getByRole('alert')).toContainText(/terms of service/i);
  });

  test('stale partial consents require consent sheet (LSA-001)', async ({ page }) => {
    await page.goto('/login?e2e=google-stale-consent');
    const dialog = page.getByRole('dialog', { name: /finish setting up your account/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /ai processing/i })).not.toBeChecked();
  });

  test('accepting terms enables submit path (mocked API)', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null;

    await page.route('**/api/v1/auth/google', async route => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid Google token' }),
      });
    });

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /terms of service/i }).check();
    await dialog.getByRole('button', { name: /continue with google/i }).click();

    await expect.poll(() => capturedBody).not.toBeNull();
    expect(capturedBody!.consents).toMatchObject({ termsAccepted: true });
    expect(capturedBody!.idToken).toBeTruthy();
  });
});

test.describe('N-1 — middleware forwards Google consents', () => {
  test('POST /auth/google with consents does not fail on missing terms', async ({ request }) => {
    await requireLiveStack(request);

    const res = await request.post(`${E2E_API_URL}/auth/google`, {
      headers: API_HEADERS,
      data: {
        idToken: 'a'.repeat(120),
        consents: {
          termsAccepted: true,
          aiProcessingAccepted: false,
          marketingAccepted: false,
          analyticsAccepted: false,
        },
      },
    });

    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = String(body.message ?? '').toLowerCase();
    expect(msg).not.toContain('terms');
  });
});

test.describe('N-8 — Google link confirm captcha forwarding', () => {
  test('POST /auth/google/link/confirm accepts captchaToken', async ({ request }) => {
    await requireLiveStack(request);

    const res = await request.post(`${E2E_API_URL}/auth/google/link/confirm`, {
      headers: API_HEADERS,
      data: {
        idToken: 'a'.repeat(120),
        password: 'Password1!',
        captchaToken: 'e2e-captcha-token',
      },
    });

    const body = (await res.json().catch(() => ({}))) as { message?: string };
    expect(res.status()).not.toBe(422);
    expect(String(body.message ?? '').toLowerCase()).not.toContain('captcha');
  });
});
