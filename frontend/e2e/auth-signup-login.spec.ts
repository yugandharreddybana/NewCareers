/**
 * Canonical signup + login E2E suite (sections A–F).
 *
 * Prerequisites:
 *   - Middleware on :4000 + Java backend reachable
 *   - Vite dev server on :5173 (or E2E_BASE_URL)
 *   - Shared profile: test@newcareer.com / Test@1234
 *
 * Run in Chrome:
 *   cd frontend && npm run test:e2e:auth:chrome
 */
import { test, expect } from '@playwright/test';
import {
  TEST_USER,
  fillSignupForm,
  fillLoginForm,
  submitAuthForm,
  acceptSignupTerms,
  expectSignupDuplicateEmailAlert,
  togglePasswordVisibility,
  expectLoginBrandVisible,
} from './helpers/auth';
import {
  requireLiveStack,
  ensureTestUser,
  deleteTestUser,
  clearAuthState,
  checkSignupEmailViaApi,
} from './helpers/stack';

test.afterAll(async ({ request }) => {
  await deleteTestUser(request);
});

test.describe('A — Signup UI', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('SU-01: signup page loads with required fields', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveTitle(/CareerOps/i);
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue to profile/i })).toBeVisible();
  });

  test('SU-02: /register redirects to /signup', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('SU-03: footer Sign In link points to /login', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login');
  });

  test('SU-04: terms and privacy links are visible', async ({ page }) => {
    await page.goto('/signup');
    const form = page.locator('form');
    await expect(form.getByRole('link', { name: /terms of service/i })).toBeVisible();
    await expect(form.getByRole('link', { name: /privacy policy/i })).toBeVisible();
  });

  test('SU-05: password strength indicator updates while typing', async ({ page }) => {
    await page.goto('/signup');
    await page.locator('#password').fill('short');
    await expect(page.getByText(/too short/i)).toBeVisible();
    await page.locator('#password').fill(TEST_USER.password);
    await expect(page.getByText(/strong|good/i)).toBeVisible();
  });

  test('SU-06: optional consent checkboxes toggle', async ({ page }) => {
    await page.goto('/signup');
    const ai = page.getByRole('checkbox', { name: /ai processing/i });
    const marketing = page.getByRole('checkbox', { name: /product tips/i });
    const analytics = page.getByRole('checkbox', { name: /usage analytics/i });
    await ai.check();
    await marketing.check();
    await analytics.check();
    await expect(ai).toBeChecked();
    await expect(marketing).toBeChecked();
    await expect(analytics).toBeChecked();
  });

  test('SU-07: session-expired banner on signup', async ({ page }) => {
    await page.goto('/signup?reason=session_expired');
    await expect(page.getByRole('status')).toContainText(/sign-up session expired/i);
  });

  test('SU-08: no session banner on plain signup', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText(/sign-up session expired/i)).toHaveCount(0);
  });
});

test.describe('B — Signup client validation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/signup');
  });

  test('SU-10: empty name shows validation error', async ({ page }) => {
    await page.locator('#email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await acceptSignupTerms(page);
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(/full name/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('SU-11: empty password shows validation error', async ({ page }) => {
    await page.locator('#name').fill(TEST_USER.name);
    await page.locator('#email').fill(TEST_USER.email);
    await acceptSignupTerms(page);
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(/password/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('SU-12: weak password is rejected', async ({ page }) => {
    await page.locator('#name').fill(TEST_USER.name);
    await page.locator('#email').fill(TEST_USER.email);
    await page.locator('#password').fill('short');
    await acceptSignupTerms(page);
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(/password|weak|short|characters/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('SU-13: fair password strength is rejected', async ({ page }) => {
    await page.locator('#name').fill(TEST_USER.name);
    await page.locator('#email').fill(TEST_USER.email);
    await page.locator('#password').fill('alllowercase');
    await acceptSignupTerms(page);
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(/weak|password/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('SU-14: terms not accepted shows error', async ({ page }) => {
    await fillSignupForm(page, TEST_USER, { terms: false });
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(/terms/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('SU-15: submit disables inputs while check-email runs', async ({ page }) => {
    await fillSignupForm(page, TEST_USER);

    await page.route('**/api/v1/auth/onboarding/check-email', async route => {
      await new Promise(r => setTimeout(r, 600));
      await route.continue();
    });

    await submitAuthForm(page);
    await expect(page.locator('#name')).toBeDisabled();
    await expect(page.locator('#email')).toBeDisabled();
    await expect(page.locator('#password')).toBeDisabled();
  });
});

test.describe('C — Signup live API', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, request }) => {
    await requireLiveStack(request);
    await clearAuthState(page);
  });

  test('SU-20: happy path reaches onboarding without session cookie', async ({ page, request }) => {
    await deleteTestUser(request);
    await page.goto('/signup');
    await fillSignupForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name === 'co_session');
    expect(session?.value?.length ?? 0).toBeLessThan(11);
  });

  test('SU-21: duplicate email blocked on signup', async ({ page, request }) => {
    await ensureTestUser(request);
    await page.goto('/signup');
    await fillSignupForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/signup/, { timeout: 20_000 });
    await expectSignupDuplicateEmailAlert(page);
  });

  test('SU-24: duplicate alert clears when email is edited', async ({ page, request }) => {
    await ensureTestUser(request);
    await page.goto('/signup');
    await fillSignupForm(page, TEST_USER);
    await submitAuthForm(page);
    await expectSignupDuplicateEmailAlert(page);
    await page.locator('#email').fill('test@newcareer.co');
    await expect(page.getByText(/already associated with this email/i)).toHaveCount(0);
  });

  test('SU-25: check-email API returns conflict for test profile', async ({ request }) => {
    await ensureTestUser(request);
    const dupResult = await checkSignupEmailViaApi(request, TEST_USER.email);
    expect(dupResult.status).toBe(409);
  });

  test('SU-26: onboarding step 1 visible after signup', async ({ page, request }) => {
    await deleteTestUser(request);
    await page.goto('/signup');
    await fillSignupForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
    await expect(
      page.getByText(/professional profile|basic identity/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('D — Login UI', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/login');
  });

  test('LO-01: renders fields and navigation links', async ({ page }) => {
    await expect(page.locator('#email')).toHaveAttribute('autocomplete', 'email');
    await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.getByRole('checkbox', { name: /keep me signed in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    await expect(page.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/signup',
    );
    await expectLoginBrandVisible(page);
  });

  test('LO-02: session-expired banner with query param', async ({ page }) => {
    await page.goto('/login?reason=session_expired');
    await expect(page.getByText(/your session expired/i)).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('LO-03: no session-expired banner without query param', async ({ page }) => {
    await expect(page.getByText(/your session expired/i)).toHaveCount(0);
  });

  test('LO-04: password visibility toggle', async ({ page }) => {
    await page.locator('#password').fill(TEST_USER.password);
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await togglePasswordVisibility(page);
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await togglePasswordVisibility(page);
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });

  test('LO-05: remember me checkbox toggles', async ({ page }) => {
    const box = page.getByRole('checkbox', { name: /keep me signed in/i });
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(box).toBeChecked();
    await box.uncheck();
    await expect(box).not.toBeChecked();
  });

  test('LO-06: empty submit stays on login', async ({ page }) => {
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('E — Login live API', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ page, request }) => {
    await requireLiveStack(request);
    await clearAuthState(page);
  });

  test('LO-10: valid credentials redirect to app', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  });

  test('LO-11: wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, { email: TEST_USER.email, password: 'WrongPass1!' });
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toContainText(
      /invalid|incorrect|wrong|failed|credentials/i,
      { timeout: 10_000 },
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('LO-12: invalid credentials for test email shows error', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, { email: TEST_USER.email, password: 'NotTest@9999' });
    await submitAuthForm(page);
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('LO-13: email is trimmed before submit', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(`  ${TEST_USER.email}  `);
    await page.locator('#password').fill(TEST_USER.password);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  });

  test('LO-16: inputs disabled while login submits', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await page.route('**/api/v1/auth/login', async route => {
      await new Promise(r => setTimeout(r, 800));
      await route.continue();
    });
    await submitAuthForm(page);
    await expect(page.locator('#email')).toBeDisabled();
    await expect(page.locator('#password')).toBeDisabled();
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 25_000 });
  });

  test('LO-17: unauthenticated dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe('F — Cross-flow signup to login', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, request }) => {
    await requireLiveStack(request);
    await clearAuthState(page);
  });

  test('XF-01: duplicate signup then login manually', async ({ page, request }) => {
    await ensureTestUser(request);
    await page.goto('/signup');
    await fillSignupForm(page, TEST_USER);
    await submitAuthForm(page);
    await expectSignupDuplicateEmailAlert(page);
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(onboarding|dashboard)/, { timeout: 20_000 });
  });

  test('XF-02: session expired signup banner then successful signup', async ({ page, request }) => {
    await deleteTestUser(request);
    await page.goto('/signup?reason=session_expired');
    await expect(page.getByRole('status')).toContainText(/sign-up session expired/i);
    await fillSignupForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  });
});
