import { test, expect } from '@playwright/test';
import {
  uniqueTestUser,
  fillSignupForm,
  fillLoginForm,
  submitAuthForm,
  type TestCredentials,
} from './helpers/auth';

/**
 * End-to-end signup + login against the real stack:
 *   Vite (5173) → middleware (4000) → Java (8080) → Postgres
 *
 * Prerequisites (must be running before tests):
 *   1. backend:  mvn spring-boot:run  (port 8080)
 *   2. middleware: npm run dev in middleware/ (port 4000)
 *   3. frontend: npm run dev in frontend/ (port 5173)
 *
 * Run (headed so you can watch):
 *   cd frontend && npm run test:e2e:signup
 */

test.describe.configure({ mode: 'serial' });

test.describe('Signup and login (live stack)', () => {
  let creds: TestCredentials;

  test.beforeAll(async ({ request }) => {
    creds = uniqueTestUser('signup');

    const health = await request.get('http://localhost:4000/health').catch(() => null);
    if (!health?.ok()) {
      throw new Error(
        'Middleware is not running on :4000. Start: cd middleware && npm run dev',
      );
    }
    const backendOk = (await health.json()) as { backendOk?: boolean };
    if (!backendOk.backendOk) {
      throw new Error(
        'Java backend is not reachable from middleware. Start: cd backend && mvn spring-boot:run (port 8080)',
      );
    }
  });

  test('signup page loads at /signup and /register redirect', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();

    await page.goto('/signup');
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test('email signup creates a dummy account and opens onboarding', async ({ page }) => {
    await page.goto('/signup');
    await fillSignupForm(page, creds);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
    await expect(
      page.getByText(/basic info|onboarding|get started/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Session cookie should exist after successful signup
    const cookies = await page.context().cookies();
    expect(cookies.some(c => c.name === 'co_session' && c.value.length > 10)).toBeTruthy();
  });

  test('clear session then login with the new dummy account', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.clear());
    await fillLoginForm(page, creds);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  });

  test('signup rejects weak password before submit', async ({ page }) => {
    await page.goto('/signup');
    await page.locator('#name').fill('Weak Pass User');
    await page.locator('#email').fill(`weak_${Date.now()}@careerops.test`);
    await page.locator('#password').fill('short');
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(/password|weak|short/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('signup shows error for duplicate email', async ({ page }) => {
    await page.goto('/signup');
    await fillSignupForm(page, creds);
    await submitAuthForm(page);

    await expect(
      page.getByRole('alert').or(page.getByText(/already|in use|exists/i)),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/signup/);
  });
});
