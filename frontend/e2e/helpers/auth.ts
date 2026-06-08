import { expect, type Page } from '@playwright/test';

export interface TestCredentials {
  name: string;
  email: string;
  password: string;
}

/** Single shared E2E profile — override via E2E_TEST_EMAIL / E2E_TEST_PASSWORD. */
export const TEST_USER: TestCredentials = {
  name: 'E2E Test User',
  email: process.env.E2E_TEST_EMAIL ?? 'test@newcareer.com',
  password: process.env.E2E_TEST_PASSWORD ?? 'Test@1234',
};

/** Dismiss GDPR cookie banner when present so it does not block form interaction. */
export async function dismissCookieBanner(page: Page): Promise<void> {
  const reject = page.getByRole('button', { name: /reject analytics/i });
  if (await reject.isVisible().catch(() => false)) {
    await reject.click();
  }
}

export async function acceptSignupTerms(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: /terms of service/i }).check();
}

export async function acceptSignupAiProcessing(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: /ai processing/i }).check();
}

export async function fillSignupForm(
  page: Page,
  creds: TestCredentials,
  opts?: { terms?: boolean; aiProcessing?: boolean },
): Promise<void> {
  await page.locator('#name').fill(creds.name);
  await page.locator('#email').fill(creds.email);
  await page.locator('#password').fill(creds.password);
  if (opts?.terms !== false) {
    await acceptSignupTerms(page);
  }
  if (opts?.aiProcessing !== false) {
    await acceptSignupAiProcessing(page);
  }
}

export async function expectSignupDuplicateEmailAlert(page: Page): Promise<void> {
  await expect(page.getByRole('alert')).toContainText(/account may already exist/i);
}

export async function gotoLoginWithEmail(page: Page, email: string): Promise<void> {
  await page.goto(`/login?email=${encodeURIComponent(email)}`);
}

export async function fillLoginForm(
  page: Page,
  creds: Pick<TestCredentials, 'email' | 'password'>,
): Promise<void> {
  await page.locator('#email').fill(creds.email);
  await page.locator('#password').fill(creds.password);
}

export async function submitAuthForm(page: Page): Promise<void> {
  await page.locator('button[type="submit"]').click();
}

/** Sign in via UI with the shared test profile. */
export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await dismissCookieBanner(page);
  await fillLoginForm(page, TEST_USER);
  await submitAuthForm(page);
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
}

export async function loginWithRememberMe(
  page: Page,
  creds: Pick<TestCredentials, 'email' | 'password'>,
  rememberMe: boolean,
): Promise<void> {
  await page.goto('/login');
  await fillLoginForm(page, creds);
  const checkbox = page.getByRole('checkbox', { name: /keep me signed in/i });
  if (rememberMe) {
    await checkbox.check();
  } else {
    await checkbox.uncheck();
  }
  await submitAuthForm(page);
}

export async function fillOtpCode(page: Page, otp: string, length = 8): Promise<void> {
  const code = otp.replace(/\D/g, '').slice(0, length);
  for (let i = 0; i < code.length; i++) {
    await page.getByRole('textbox', { name: `Digit ${i + 1}` }).fill(code[i]!);
  }
}

export async function pasteOtpCode(page: Page, otp: string, length = 8): Promise<void> {
  const first = page.getByRole('textbox', { name: 'Digit 1' });
  await first.focus();
  await page.evaluate(async code => {
    await navigator.clipboard.writeText(code);
  }, otp.replace(/\D/g, '').slice(0, length));
  await first.press('ControlOrMeta+V');
}

export async function expectNewCareersVisible(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'NewCareers' }).first()).toBeVisible();
}

export async function expectLoginBrandVisible(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'CareerOps' }).first()).toBeVisible();
}

export async function expectPageTitleContainsNewCareers(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/NewCareers/i);
}

export async function togglePasswordVisibility(page: Page): Promise<void> {
  await page.getByRole('button', { name: /show password|hide password/i }).click();
}

export async function goToForgotPasswordVerifyStep(
  page: Page,
  email: string,
): Promise<void> {
  await page.goto('/forgot-password');
  await page.locator('#email').fill(email);
  await submitAuthForm(page);
  await expect(page.getByRole('group', { name: /verification code/i })).toBeVisible({
    timeout: 15_000,
  });
}
