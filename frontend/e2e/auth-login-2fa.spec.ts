/**
 * LSA-T11 — Login 2FA UI flow with remember-me body forwarding.
 */
import { test, expect } from '@playwright/test';
import { clearAuthState } from './helpers/stack';
import { dismissCookieBanner } from './helpers/auth';

const MOCK_USER = {
  id: 'e2e-2fa-user',
  email: '2fa@example.com',
  name: '2FA User',
  onboarded: true,
  role: 'USER',
};

test.describe('Login — 2FA step (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/login');
    await dismissCookieBanner(page);
  });

  test('password login → 2FA step → verify with rememberMe in body', async ({ page }) => {
    let verifyBody: Record<string, unknown> | null = null;

    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requiresTwoFactor: true,
          challengeToken: 'e2e-challenge-token',
        }),
      });
    });

    await page.route('**/api/v1/auth/two-factor/verify', async route => {
      verifyBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'e2e-access-token',
          user: MOCK_USER,
        }),
      });
    });

    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('Password1!');
    await page.getByRole('checkbox', { name: /keep me signed in/i }).check();
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/authenticator app/i)).toBeVisible();
    await expect(page.getByRole('group', { name: /6-digit verification code/i })).toBeVisible();

    for (let i = 1; i <= 6; i += 1) {
      await page.getByLabel(`Digit ${i}`).fill(String(i % 10));
    }

    await page.getByRole('button', { name: /verify & sign in/i }).click();

    await expect.poll(() => verifyBody).not.toBeNull();
    expect(verifyBody).toMatchObject({
      challengeToken: 'e2e-challenge-token',
      rememberMe: true,
    });
    expect(String(verifyBody!.code)).toHaveLength(6);
  });

  test('2FA failure shows generic login error', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requiresTwoFactor: true,
          challengeToken: 'e2e-challenge-token',
        }),
      });
    });

    await page.route('**/api/v1/auth/two-factor/verify', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid verification code' }),
      });
    });

    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('Password1!');
    await page.locator('button[type="submit"]').click();

    for (let i = 1; i <= 6; i += 1) {
      await page.getByLabel(`Digit ${i}`).fill('1');
    }
    await page.getByRole('button', { name: /verify & sign in/i }).click();

    await expect(page.getByRole('alert')).toContainText(/email or password/i);
  });
});
