import { test, type APIRequestContext, type Page } from '@playwright/test';
import type { TestCredentials } from './auth';
import { TEST_USER } from './auth';

export { TEST_USER };

export const E2E_MIDDLEWARE_URL = process.env.E2E_MIDDLEWARE_URL ?? 'http://localhost:4000';
export const E2E_API_URL = process.env.E2E_API_URL ?? `${E2E_MIDDLEWARE_URL}/api/v1`;

const API_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' };

async function postWithRateLimitRetry(
  request: APIRequestContext,
  url: string,
  data: unknown,
  retries = 6,
): Promise<Awaited<ReturnType<APIRequestContext['post']>>> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const r = await request.post(url, { data, headers: API_HEADERS });
    if (r.status() !== 429) return r;
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return request.post(url, { data, headers: API_HEADERS });
}

/** Skip the current test when the live stack (middleware + Java) is not up. */
export async function requireLiveStack(request: APIRequestContext): Promise<void> {
  const health = await request.get(`${E2E_MIDDLEWARE_URL}/health`).catch(() => null);
  if (!health?.ok()) {
    test.skip(true, 'Middleware is not running on :4000 — start middleware + backend first.');
    return;
  }
  const body = (await health.json()) as { backendOk?: boolean };
  if (!body.backendOk) {
    test.skip(true, 'Java backend is not reachable from middleware.');
  }
}

/** True when middleware + Java backend respond healthy. */
export async function isLiveStackUp(request: APIRequestContext): Promise<boolean> {
  const health = await request.get(`${E2E_MIDDLEWARE_URL}/health`).catch(() => null);
  if (!health?.ok()) return false;
  const body = (await health.json()) as { backendOk?: boolean };
  return Boolean(body.backendOk);
}

export function usernameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'user';
  return local.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user';
}

export async function completeOnboardingVerificationViaApi(
  request: APIRequestContext,
  email: string,
  otp = '00000000',
): Promise<string> {
  const send = await postWithRateLimitRetry(request, `${E2E_API_URL}/auth/onboarding/send-verification-otp`, {
    email,
    firstName: 'E2E',
  });
  if (!send.ok() && send.status() !== 202) {
    throw new Error(`Send verification OTP failed: ${send.status()} ${await send.text()}`);
  }

  const verify = await postWithRateLimitRetry(request, `${E2E_API_URL}/auth/onboarding/verify-email`, {
    email,
    otp,
    captchaToken: '',
  });
  if (!verify.ok()) {
    throw new Error(`Verify email failed: ${verify.status()} ${await verify.text()}`);
  }
  const body = (await verify.json()) as { verificationId?: string };
  if (!body.verificationId) {
    throw new Error('Verify email response missing verificationId');
  }
  return body.verificationId;
}

/** @deprecated Signup uses POST /auth/signup-intent; always returns { available: true } for anti-enumeration. */
export async function checkSignupEmailViaApi(
  request: APIRequestContext,
  email: string,
): Promise<{ status: number; available?: boolean }> {
  const r = await postWithRateLimitRetry(request, `${E2E_API_URL}/auth/onboarding/check-email`, { email });
  const body = r.ok() ? ((await r.json()) as { available?: boolean }) : undefined;
  return { status: r.status(), available: body?.available };
}

export async function createSignupIntentViaApi(
  request: APIRequestContext,
  creds: TestCredentials,
): Promise<{ status: number; body?: unknown }> {
  const r = await postWithRateLimitRetry(request, `${E2E_API_URL}/auth/signup-intent`, {
    email: creds.email,
    password: creds.password,
    name: creds.name,
    consents: {
      termsAccepted: true,
      aiProcessingAccepted: true,
      marketingAccepted: false,
      analyticsAccepted: false,
    },
  });
  const body = r.ok() ? await r.json().catch(() => undefined) : await r.text().catch(() => undefined);
  return { status: r.status(), body };
}

/** Internal — use ensureTestUser from specs instead of calling directly. */
async function registerUserViaApi(
  request: APIRequestContext,
  creds: TestCredentials,
  username?: string,
): Promise<void> {
  const emailVerificationId = await completeOnboardingVerificationViaApi(request, creds.email);
  const r = await postWithRateLimitRetry(request, `${E2E_API_URL}/auth/signup`, {
    name: creds.name,
    email: creds.email,
    password: creds.password,
    username: username ?? usernameFromEmail(creds.email),
    emailVerificationId,
    consents: {
      termsAccepted: true,
      aiProcessingAccepted: true,
      marketingAccepted: false,
      analyticsAccepted: false,
    },
  });
  if (!r.ok()) {
    throw new Error(`Signup API failed: ${r.status()} ${await r.text()}`);
  }
}

export async function fetchWordCaptchaToken(request: APIRequestContext): Promise<string> {
  const r = await request.get(`${E2E_API_URL}/auth/captcha/challenge`, { headers: API_HEADERS });
  if (!r.ok()) {
    throw new Error(`Captcha challenge failed: ${r.status()} ${await r.text()}`);
  }
  const body = (await r.json()) as {
    challengeId: string;
    letters: Array<{ character: string }>;
  };
  const answer = body.letters.map(l => l.character).join('');
  return `${body.challengeId}:${answer}`;
}

export async function loginUserViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
  rememberMe = false,
): Promise<{ token?: string; refreshToken?: string; user?: { onboarded?: boolean } }> {
  const body: Record<string, unknown> = { email, password, rememberMe };
  try {
    body.captchaToken = await fetchWordCaptchaToken(request);
  } catch {
    /* Word CAPTCHA optional when auth.login.word-captcha.required=false */
  }
  const r = await postWithRateLimitRetry(request, `${E2E_API_URL}/auth/login`, body);
  if (!r.ok()) {
    throw new Error(`Login API failed: ${r.status()} ${await r.text()}`);
  }
  return r.json() as Promise<{ token?: string; refreshToken?: string }>;
}

async function tryLoginUserViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<boolean> {
  try {
    await loginUserViaApi(request, email, password);
    return true;
  } catch {
    return false;
  }
}

async function markTestUserOnboardedViaApi(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  const r = await request.put(`${E2E_API_URL}/profile`, {
    data: {
      onboarded: true,
      targetRoles: ['Software Engineer'],
      techStack: ['TypeScript', 'React'],
      location: 'Remote',
    },
    headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
  });
  if (!r.ok()) {
    throw new Error(`Mark test user onboarded failed: ${r.status()} ${await r.text()}`);
  }
}

/** Login if the shared test profile exists; register once if missing. */
export async function ensureTestUser(request: APIRequestContext): Promise<void> {
  if (await tryLoginUserViaApi(request, TEST_USER.email, TEST_USER.password)) {
    const auth = await loginUserViaApi(request, TEST_USER.email, TEST_USER.password);
    if (auth.token && !auth.user?.onboarded) {
      await markTestUserOnboardedViaApi(request, auth.token);
    }
    return;
  }
  try {
    await registerUserViaApi(request, TEST_USER);
  } catch (err) {
    const probe = await createSignupIntentViaApi(request, TEST_USER);
    if (probe.status === 409) {
      throw new Error(
        `Test user ${TEST_USER.email} exists but login failed — verify E2E_TEST_PASSWORD matches the registered account or delete the user manually.`,
      );
    }
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Test user ${TEST_USER.email} setup failed after login miss: ${detail}`,
    );
  }
  const auth = await loginUserViaApi(request, TEST_USER.email, TEST_USER.password);
  if (auth.token) {
    await markTestUserOnboardedViaApi(request, auth.token);
  }
}

/** Delete the shared test profile (no-op when already absent). */
export async function deleteTestUser(request: APIRequestContext): Promise<void> {
  const loggedIn = await tryLoginUserViaApi(request, TEST_USER.email, TEST_USER.password);
  if (!loggedIn) return;

  const auth = await loginUserViaApi(request, TEST_USER.email, TEST_USER.password);
  const headers: Record<string, string> = { ...API_HEADERS };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const r = await request.post(`${E2E_API_URL}/account/delete`, {
    data: { password: TEST_USER.password },
    headers,
  });
  if (r.status() >= 500) {
    throw new Error(`Delete account failed: ${r.status()} ${await r.text()}`);
  }
}

export async function forgotPasswordViaApi(
  request: APIRequestContext,
  email: string,
): Promise<void> {
  const r = await request.post(`${E2E_API_URL}/auth/forgot-password`, {
    data: { email },
    headers: API_HEADERS,
  });
  if (!r.ok() && r.status() !== 202) {
    throw new Error(`Forgot-password API failed: ${r.status()} ${await r.text()}`);
  }
}

export async function clearAuthState(page: Page): Promise<void> {
  await page.context().clearCookies();
  const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  await page.goto(`${baseURL}/`);
  const { dismissCookieBanner } = await import('./auth');
  await dismissCookieBanner(page);
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('co_token');
    localStorage.removeItem('co_refresh');
    localStorage.removeItem('co_user');
  });
}

export type AuthCookieNames = {
  session?: { name: string; value: string; maxAge?: number };
  refresh?: { name: string; value: string; maxAge?: number };
  remember?: { name: string; value: string };
};

export async function readAuthCookies(page: Page): Promise<AuthCookieNames> {
  const cookies = await page.context().cookies();
  const session = cookies.find(c => c.name === 'co_session');
  const refresh = cookies.find(c => c.name === 'co_refresh');
  const remember = cookies.find(c => c.name === 'co_remember');
  return {
    session: session ? { name: session.name, value: session.value, maxAge: session.expires } : undefined,
    refresh: refresh ? { name: refresh.name, value: refresh.value, maxAge: refresh.expires } : undefined,
    remember: remember ? { name: remember.name, value: remember.value } : undefined,
  };
}
