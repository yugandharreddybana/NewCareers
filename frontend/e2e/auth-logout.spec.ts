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
  readAuthCookies,
  E2E_API_URL,
} from './helpers/stack';

test.describe('Logout', () => {
  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ request }) => {
    await requireLiveStack(request);
  });

  test('logout from browser clears cookies and requires login again', async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    const before = await readAuthCookies(page);
    expect(before.session?.value.length).toBeGreaterThan(10);

    await page.evaluate(async () => {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    });

    const after = await readAuthCookies(page);
    expect(after.session?.value ?? '').toBeFalsy();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('logout API clears session even when called directly', async ({ request }) => {
    const login = await request.post(`${E2E_API_URL}/auth/login`, {
      data: { email: TEST_USER.email, password: TEST_USER.password },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(login.ok()).toBeTruthy();
    const { token } = (await login.json()) as { token?: string };
    expect(token).toBeTruthy();

    const logout = await request.post(`${E2E_API_URL}/auth/logout`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Authorization: `Bearer ${token}`,
      },
    });
    expect(logout.ok()).toBeTruthy();
  });
});
