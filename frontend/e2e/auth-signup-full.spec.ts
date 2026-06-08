import { test, expect } from '@playwright/test';
import {
  TEST_USER,
  fillSignupForm,
  submitAuthForm,
} from './helpers/auth';
import {
  requireLiveStack,
  ensureTestUser,
  deleteTestUser,
  clearAuthState,
  checkSignupEmailViaApi,
  E2E_API_URL,
} from './helpers/stack';

test.afterAll(async ({ request }) => {
  await deleteTestUser(request);
});

test.describe('Signup — deferred account creation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('/register redirects to /signup', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('signup form shows all required fields', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    await expect(page).toHaveTitle(/CareerOps/i);
  });

  test('empty name shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.locator('#email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(/full name|name/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('SU-14: terms not accepted shows error', async ({ page }) => {
    await page.goto('/signup');
    await fillSignupForm(page, TEST_USER, { terms: false });
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(/terms/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('SU-16: AI consent required blocks signup', async ({ page }) => {
    await page.goto('/signup');
    await fillSignupForm(page, TEST_USER, { aiProcessing: false });
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(/ai processing consent/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('password strength indicator updates while typing', async ({ page }) => {
    await page.goto('/signup');
    await page.locator('#password').fill('short');
    await expect(page.getByText(/too short/i)).toBeVisible();
    await page.locator('#password').fill(TEST_USER.password);
    await expect(page.getByText(/strong|good/i)).toBeVisible();
  });

  test('terms and privacy links are present', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('link', { name: /terms/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy/i })).toBeVisible();
  });
});

test.describe('Signup — live API registration', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
  });

  test('API signup returns tokens and user after email verification', async ({ request }) => {
    await deleteTestUser(request);
    const { completeOnboardingVerificationViaApi } = await import('./helpers/stack');
    const emailVerificationId = await completeOnboardingVerificationViaApi(request, TEST_USER.email);
    const r = await request.post(`${E2E_API_URL}/auth/signup`, {
      data: {
        name: TEST_USER.name,
        email: TEST_USER.email,
        password: TEST_USER.password,
        username: 'test',
        emailVerificationId,
        consents: {
          termsAccepted: true,
          aiProcessingAccepted: true,
          marketingAccepted: false,
          analyticsAccepted: false,
        },
      },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(r.ok()).toBeTruthy();
    const body = (await r.json()) as { token?: string; user?: { email?: string } };
    expect(body.token?.length).toBeGreaterThan(10);
    expect(body.user?.email).toBe(TEST_USER.email);
  });

  test('onboarding verification OTP send and verify API', async ({ request }) => {
    const { completeOnboardingVerificationViaApi } = await import('./helpers/stack');
    const verificationId = await completeOnboardingVerificationViaApi(request, TEST_USER.email);
    expect(verificationId.length).toBeGreaterThan(10);
  });

  test('SU-25: signup-intent API returns conflict for registered email', async ({ request }) => {
    await ensureTestUser(request);
    const { createSignupIntentViaApi } = await import('./helpers/stack');
    const conflict = await createSignupIntentViaApi(request, TEST_USER);
    expect(conflict.status).toBe(409);
  });

  test('duplicate email via API is rejected', async ({ request }) => {
    await ensureTestUser(request);
    const { completeOnboardingVerificationViaApi } = await import('./helpers/stack');
    const emailVerificationId = await completeOnboardingVerificationViaApi(request, TEST_USER.email);

    const r = await request.post(`${E2E_API_URL}/auth/signup`, {
      data: {
        name: TEST_USER.name,
        email: TEST_USER.email,
        password: TEST_USER.password,
        username: 'test2',
        emailVerificationId,
        consents: {
          termsAccepted: true,
          aiProcessingAccepted: true,
          marketingAccepted: false,
          analyticsAccepted: false,
        },
      },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(r.ok()).toBeFalsy();
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });
});
