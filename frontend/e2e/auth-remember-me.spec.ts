import { test, expect } from '@playwright/test';
import {
  TEST_USER,
  loginWithRememberMe,
} from './helpers/auth';
import {
  requireLiveStack,
  ensureTestUser,
  clearAuthState,
  readAuthCookies,
} from './helpers/stack';

test.describe.configure({ mode: 'serial' });

test.describe('Remember Me', () => {
  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('remember me checked sets co_refresh and co_remember cookies', async ({ page }) => {
    await loginWithRememberMe(page, TEST_USER, true);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    const cookies = await readAuthCookies(page);
    expect(cookies.session?.value.length).toBeGreaterThan(10);
    expect(cookies.refresh?.value.length).toBeGreaterThan(10);
    expect(cookies.remember?.value).toBe('1');
  });

  test('remember me checked persists session after page reload', async ({ page }) => {
    await loginWithRememberMe(page, TEST_USER, true);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    await page.reload();
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });
  });

  test('remember me unchecked does not set co_remember flag', async ({ page }) => {
    await loginWithRememberMe(page, TEST_USER, false);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    const cookies = await readAuthCookies(page);
    expect(cookies.remember).toBeUndefined();
  });

  test('session without remember me is lost after clearing cookies', async ({ page }) => {
    await loginWithRememberMe(page, TEST_USER, false);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    await clearAuthState(page);
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('new browser context without cookies requires sign-in even after remember login', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginWithRememberMe(page, TEST_USER, true);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    const fresh = await browser.newContext();
    const guest = await fresh.newPage();
    await guest.goto('/onboarding');
    await expect(guest).toHaveURL(/\/login/, { timeout: 15_000 });

    await ctx.close();
    await fresh.close();
  });
});
