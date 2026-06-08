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
} from './helpers/stack';

const GUEST_AUTH_PATHS = ['/login', '/signup', '/register', '/forgot-password'] as const;

test.describe('Route guards — guest', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  for (const path of GUEST_AUTH_PATHS) {
    test(`unauthenticated user can access ${path}`, async ({ page }) => {
      await page.goto(path);
      if (path === '/register') {
        await expect(page).toHaveURL(/\/signup/);
      } else {
        await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
      }
    });
  }

  test('/register redirects to /signup', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/\/signup$/);
  });
});

test.describe('Route guards — protected routes', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated /kanban redirects to /login', async ({ page }) => {
    await page.goto('/kanban');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated /account redirects to /login', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated /account/profile redirects to /login', async ({ page }) => {
    await page.goto('/account/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe('Route guards — authenticated guest routes', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ request, page }) => {
    await requireLiveStack(request);
    await clearAuthState(page);
  });

  test('logged-in user visiting /login is redirected away', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    await page.goto('/login');
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 10_000 });
  });

  test('logged-in user visiting /signup is redirected away', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    await page.goto('/signup');
    await expect(page).not.toHaveURL(/\/signup$/, { timeout: 10_000 });
  });

  test('logged-in user visiting /forgot-password is redirected away', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    await page.goto('/forgot-password');
    await expect(page).not.toHaveURL(/\/forgot-password$/, { timeout: 10_000 });
  });
});
