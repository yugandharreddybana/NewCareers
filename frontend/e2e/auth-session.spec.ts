import { test, expect } from '@playwright/test';
import {
  TEST_USER,
  fillLoginForm,
  submitAuthForm,
} from './helpers/auth';
import {
  requireLiveStack,
  ensureTestUser,
  clearAuthState,
  E2E_API_URL,
} from './helpers/stack';

test.describe('Session refresh', () => {
  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ request }) => {
    await requireLiveStack(request);
  });

  test('refresh endpoint accepts cookie-based refresh after remember-me login', async ({
    page,
  }) => {
    await clearAuthState(page);
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await page.getByRole('checkbox', { name: /keep me signed in/i }).check();
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    const cookies = await page.context().cookies();
    const refreshCookie = cookies.find(c => c.name === 'co_refresh');
    expect(refreshCookie?.value.length).toBeGreaterThan(10);

    const refresh = await page.request.post(`${E2E_API_URL}/auth/refresh`, {
      data: {},
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: `co_refresh=${refreshCookie!.value}`,
      },
    });
    expect(refresh.ok()).toBeTruthy();
    const body = (await refresh.json()) as { token?: string };
    expect(body.token?.length).toBeGreaterThan(10);
  });

  test('remember-me login omits refreshToken from JSON body', async ({ page }) => {
    let loginBody: { refreshToken?: string } = {};
    await page.route('**/api/v1/auth/login', async route => {
      const response = await route.fetch();
      loginBody = (await response.json()) as { refreshToken?: string };
      await route.fulfill({ response });
    });

    await clearAuthState(page);
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await page.getByRole('checkbox', { name: /keep me signed in/i }).check();
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    expect(loginBody.refreshToken).toBeUndefined();
  });

  test('non-remember login includes refreshToken in JSON body', async ({ page }) => {
    let loginBody: { refreshToken?: string } = {};
    await page.route('**/api/v1/auth/login', async route => {
      const response = await route.fetch();
      loginBody = (await response.json()) as { refreshToken?: string };
      await route.fulfill({ response });
    });

    await clearAuthState(page);
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await page.getByRole('checkbox', { name: /keep me signed in/i }).uncheck();
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    expect(loginBody.refreshToken?.length).toBeGreaterThan(10);
  });
});

test.describe('Session expiry redirect', () => {
  test('unauthenticated dashboard visit lands on login', async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
