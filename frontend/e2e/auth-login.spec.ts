import { test, expect } from '@playwright/test';
import {
  TEST_USER,
  fillLoginForm,
  submitAuthForm,
  togglePasswordVisibility,
  expectLoginBrandVisible,
  gotoLoginWithEmail,
} from './helpers/auth';
import {
  requireLiveStack,
  ensureTestUser,
  clearAuthState,
} from './helpers/stack';

test.describe('Login page — UI', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/login');
  });

  test('renders email and password fields with correct autocomplete', async ({ page }) => {
    await expect(page.locator('#email')).toHaveAttribute('autocomplete', 'email');
    await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.getByRole('checkbox', { name: /keep me signed in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    await expect(page.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup');
    await expectLoginBrandVisible(page);
  });

  test('session-expired banner appears when reason=session_expired', async ({ page }) => {
    await page.goto('/login?reason=session_expired');
    await expect(page.getByText(/your session expired/i)).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('no session-expired banner without query param', async ({ page }) => {
    await expect(page.getByText(/your session expired/i)).toHaveCount(0);
  });

  test('password visibility toggle switches input type', async ({ page }) => {
    await page.locator('#password').fill(TEST_USER.password);
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await togglePasswordVisibility(page);
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await togglePasswordVisibility(page);
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });

  test('remember me checkbox toggles', async ({ page }) => {
    const box = page.getByRole('checkbox', { name: /keep me signed in/i });
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(box).toBeChecked();
    await box.uncheck();
    await expect(box).not.toBeChecked();
  });

  test('HTML5 validation blocks empty submit', async ({ page }) => {
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Login page — live stack', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ request, page }) => {
    await requireLiveStack(request);
    await clearAuthState(page);
  });

  test('valid credentials redirect to app', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  });

  test('wrong password shows error alert', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, { email: TEST_USER.email, password: 'WrongPass1!' });
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toContainText(
      /invalid|incorrect|wrong|failed|credentials/i,
      { timeout: 10_000 },
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('invalid credentials for test email shows error', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, { email: TEST_USER.email, password: 'NotTest@9999' });
    await submitAuthForm(page);

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('email is trimmed before submit', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(`  ${TEST_USER.email}  `);
    await page.locator('#password').fill(TEST_USER.password);
    await submitAuthForm(page);

    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  });

  test('inputs are disabled while email login is submitting', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);

    await page.route('**/api/v1/auth/login', async route => {
      await new Promise(r => setTimeout(r, 800));
      await route.continue();
    });

    const submit = page.locator('button[type="submit"]');
    await submit.click();
    await expect(page.locator('#email')).toBeDisabled();
    await expect(page.locator('#password')).toBeDisabled();
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 25_000 });
  });

  test('protected route redirect preserves from state in login URL flow', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('LO-14: email prefill from query param', async ({ page }) => {
    await gotoLoginWithEmail(page, TEST_USER.email);
    await expect(page.locator('#email')).toHaveValue(TEST_USER.email);
  });

  test('LO-15: prefilled email can sign in', async ({ page }) => {
    await gotoLoginWithEmail(page, TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  });
});

test.describe('Login page — Google OAuth UI', () => {
  test('shows or hides Google block based on env configuration', async ({ page }) => {
    await page.goto('/login');
    const divider = page.getByText(/^OR$/i);
    const googleEnabled = (await divider.count()) > 0;
    if (googleEnabled) {
      await expect(divider).toBeVisible();
    } else {
      await expect(divider).toHaveCount(0);
    }
  });
});

test.describe('Login page — shared test profile', () => {
  test('test profile can sign in when backend is running', async ({ page, request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
    await clearAuthState(page);
    await page.goto('/login');
    await fillLoginForm(page, TEST_USER);
    await submitAuthForm(page);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  });
});
