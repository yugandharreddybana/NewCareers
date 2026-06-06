import { test, expect } from '@playwright/test';

/** UI captcha tests need VITE_LOGIN_CAPTCHA_REQUIRED=true when starting Vite. */
const CAPTCHA_UI_ENABLED = process.env.E2E_LOGIN_CAPTCHA === 'true';
import {
  TEST_USER,
  fillLoginForm,
  submitAuthForm,
} from './helpers/auth';
import {
  requireLiveStack,
  ensureTestUser,
  clearAuthState,
} from './helpers/stack';

test.describe('Login word CAPTCHA', () => {
  test.skip(!CAPTCHA_UI_ENABLED, 'Set E2E_LOGIN_CAPTCHA=true and VITE_LOGIN_CAPTCHA_REQUIRED=true');

  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('security check visible on page load', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Security check')).toBeVisible();
    await expect(page.getByPlaceholder('Type the characters above')).toBeVisible();
  });

  test('client-side error when security check not completed', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(/security check/i);
  });

  test('login with solved word captcha (mocked challenge)', async ({ page }) => {
    await page.route('**/api/v1/auth/captcha/challenge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          challengeId: 'test-challenge-id',
          letters: [
            { character: 'A', rotate: 0, translateY: 0, color: '#022c22' },
            { character: 'B', rotate: 5, translateY: 1, color: '#10b981' },
            { character: 'C', rotate: -3, translateY: 0, color: '#374151' },
          ],
        }),
      });
    });

    let loginBody: { captchaToken?: string } | null = null;
    await page.route('**/api/v1/auth/login', async route => {
      loginBody = route.request().postDataJSON() as { captchaToken?: string };
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials', status: 401, captchaRequired: true }),
      });
    });

    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await page.getByPlaceholder('Type the characters above').fill('ABC');
    await submitAuthForm(page);

    expect(loginBody?.captchaToken).toBe('test-challenge-id:ABC');
  });
});

test.describe('Login word CAPTCHA — live stack', () => {
  test('challenge endpoint returns jumbled letters', async ({ request }) => {
    await requireLiveStack(request);
    const res = await request.get('/api/v1/auth/captcha/challenge');
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      challengeId: string;
      letters: { character: string }[];
    };
    expect(body.challengeId).toBeTruthy();
    expect(body.letters.length).toBeGreaterThanOrEqual(4);
  });

  test('security check renders on login before submit', async ({ page, request }) => {
    test.skip(!CAPTCHA_UI_ENABLED, 'Captcha UI disabled in dev');
    await requireLiveStack(request);
    await ensureTestUser(request);
    await clearAuthState(page);
    await page.goto('/login');
    await expect(page.getByLabel('Security check')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('Type the characters above')).toBeVisible();
  });
});
