/**
 * Login.tsx — sign-in page with Remember Me, jumbled word CAPTCHA below password, and session-expired banner.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/authCtx';
import { PageMeta } from '@/components/PageMeta';
import { LoginPageShell } from '@/components/auth/LoginPageShell';
import { LoginGoogleButton } from '@/components/auth/LoginGoogleButton';
import { WordCaptchaField } from '@/components/auth/WordCaptchaField';
import { GoogleConsentSheet } from '@/components/auth/GoogleConsentSheet';
import {
  LOGIN_BRAND,
  LOGIN_DIVIDER,
  LOGIN_EMAIL_LABEL,
  LOGIN_EMAIL_PLACEHOLDER,
  LOGIN_FOOTER_CTA,
  LOGIN_FOOTER_PREFIX,
  LOGIN_FORGOT_PASSWORD,
  LOGIN_GOOGLE_LABEL,
  LOGIN_PASSWORD_LABEL,
  LOGIN_REMEMBER_LABEL,
  LOGIN_SUBMIT_LABEL,
  LOGIN_SUBTITLE,
  LOGIN_TAGLINE,
  LOGIN_WELCOME,
} from '@/components/auth/loginCopy';
import { LOGIN_WORD_CAPTCHA_REQUIRED, IS_DEV } from '@/lib/env';
import {
  GENERIC_GOOGLE_ERROR,
  GENERIC_LOGIN_ERROR,
} from '@/lib/authErrors';
import { CAPTCHA_ENABLED, RecaptchaBlock } from '@/components/auth/RecaptchaBlock';
import ReCAPTCHA from 'react-google-recaptcha';
import { authApi } from '@/services/api';
import {
  clearPendingGoogleConsents,
  readPendingGoogleConsents,
  resolveGoogleLoginConsent,
  writePendingGoogleConsents,
} from '@/lib/pendingGoogleConsents';
import { OtpInput } from '@/components/auth/OtpInput';
import { isApiError } from '@/types';
import {
  clearPendingGoogleLink,
  readPendingGoogleLink,
  writePendingGoogleLink,
} from '@/lib/pendingGoogleLink';
import { writeAnalyticsConsent } from '@/lib/cookieConsent';
import type { SignupConsents } from '@/lib/pendingSignup';

const EMAIL_PARAM_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#022c22]/15 focus:border-[#022c22] transition-colors placeholder:text-gray-400 disabled:opacity-60';

function safeEmailFromParam(raw: string | null): string {
  const trimmed = raw?.trim() ?? '';
  return EMAIL_PARAM_PATTERN.test(trimmed) ? trimmed : '';
}

export default function Login() {
  const { signIn, signInWithGoogle, completeTwoFactor, setUser, actionLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const prefillEmail = safeEmailFromParam(searchParams.get('email'));

  const [form, setForm] = useState(() => ({
    email: prefillEmail,
    password: '',
  }));
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleLinkToken, setGoogleLinkToken] = useState<string | null>(() => readPendingGoogleLink());
  const [linkPassword, setLinkPassword] = useState('');
  const linkCaptchaRef = useRef<ReCAPTCHA>(null);
  const [linkCaptchaToken, setLinkCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [captchaRequired, setCaptchaRequired] = useState(LOGIN_WORD_CAPTCHA_REQUIRED);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [googleConsentOpen, setGoogleConsentOpen] = useState(false);
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(null);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const email = safeEmailFromParam(searchParams.get('email'));
    if (!email) return;
    setForm(f => (f.email === email ? f : { ...f, email }));
    const params = new URLSearchParams(searchParams);
    params.delete('email');
    const qs = params.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, '', next);
  }, [searchParams]);

  useEffect(() => {
    if (!IS_DEV || searchParams.get('e2e') !== 'google-consent') return;
    setPendingGoogleToken('e2e-stub-google-token');
    setGoogleConsentOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!IS_DEV || searchParams.get('e2e') !== 'google-stale-consent') return;
    writePendingGoogleConsents({
      termsAccepted: true,
      aiProcessingAccepted: false,
      marketingAccepted: false,
      analyticsAccepted: false,
    });
    const decision = resolveGoogleLoginConsent(readPendingGoogleConsents());
    if (decision.kind === 'show_sheet') {
      if (decision.clearStale) clearPendingGoogleConsents();
      setPendingGoogleToken('e2e-stub-google-token');
      setGoogleConsentOpen(true);
    }
  }, [searchParams]);

  const busy = emailSubmitting || googleSubmitting || actionLoading;
  const showTwoFactorStep = Boolean(twoFactorChallenge);
  const showCaptcha = captchaRequired || LOGIN_WORD_CAPTCHA_REQUIRED;

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const focusError = () => {
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const refreshCaptcha = () => {
    setCaptchaKey(k => k + 1);
    setCaptchaToken(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!EMAIL_PARAM_PATTERN.test(form.email.trim())) {
      setError(GENERIC_LOGIN_ERROR);
      focusError();
      return;
    }

    if (!form.password || form.password.length < 8) {
      setError(GENERIC_LOGIN_ERROR);
      focusError();
      return;
    }

    if (showCaptcha && !captchaToken) {
      setError('Please enter the security check characters.');
      focusError();
      return;
    }

    setEmailSubmitting(true);
    try {
      await signIn(form.email, form.password, {
        rememberMe,
        ...(showCaptcha && captchaToken ? { captchaToken } : {}),
      });
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.message === 'TWO_FACTOR_REQUIRED' &&
        'challengeToken' in err &&
        typeof (err as { challengeToken?: string }).challengeToken === 'string'
      ) {
        setTwoFactorChallenge((err as { challengeToken: string }).challengeToken);
        setTwoFactorCode('');
        setError('');
        return;
      }
      if (isApiError(err)) {
        if (err.captchaRequired) {
          setCaptchaRequired(true);
          refreshCaptcha();
        }
        setError(GENERIC_LOGIN_ERROR);
      } else {
        setError(GENERIC_LOGIN_ERROR);
      }
      if (showCaptcha) refreshCaptcha();
      focusError();
    } finally {
      setEmailSubmitting(false);
    }
  };

  const submitTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorChallenge || twoFactorCode.length !== 6) return;
    setError('');
    try {
      await completeTwoFactor(twoFactorChallenge, twoFactorCode, rememberMe);
      setTwoFactorChallenge(null);
      setTwoFactorCode('');
    } catch {
      setError(GENERIC_LOGIN_ERROR);
      setTwoFactorCode('');
      if (showCaptcha) refreshCaptcha();
      focusError();
    }
  };

  const cancelTwoFactor = () => {
    setTwoFactorChallenge(null);
    setTwoFactorCode('');
    setError('');
  };

  const completeGoogleSignIn = async (
    idToken: string,
    consents?: SignupConsents,
    captchaToken?: string | null,
  ) => {
    setError('');
    setGoogleSubmitting(true);
    try {
      if (consents) {
        writePendingGoogleConsents(consents);
        writeAnalyticsConsent(consents.analyticsAccepted);
      }
      await signInWithGoogle(idToken, rememberMe, consents, captchaToken ?? undefined);
      setGoogleConsentOpen(false);
      setPendingGoogleToken(null);
    } catch (err: unknown) {
      if (isApiError(err) && err.status === 409) {
        const code = (err.response?.data as { code?: string } | undefined)?.code;
        if (code === 'LINK_REQUIRES_VERIFICATION') {
          writePendingGoogleLink(idToken);
          setGoogleLinkToken(idToken);
          setLinkPassword('');
          setGoogleConsentOpen(false);
          setPendingGoogleToken(null);
          setError('Enter your account password to link Google sign-in.');
          focusError();
          return;
        }
      }
      if (isApiError(err) && err.status === 400) {
        const msg = err.normalizedMessage ?? '';
        if (msg.toLowerCase().includes('terms')) {
          setPendingGoogleToken(idToken);
          setGoogleConsentOpen(true);
          return;
        }
      }
      setError(GENERIC_GOOGLE_ERROR);
      focusError();
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleGoogle = async (idToken: string) => {
    const decision = resolveGoogleLoginConsent(readPendingGoogleConsents());
    if (decision.kind === 'show_sheet') {
      if (decision.clearStale) clearPendingGoogleConsents();
      setPendingGoogleToken(idToken);
      setGoogleConsentOpen(true);
      return;
    }
    await completeGoogleSignIn(idToken, decision.consents);
  };

  const handleGoogleConsentSubmit = async (consents: SignupConsents, captchaToken: string | null) => {
    if (!pendingGoogleToken) return;
    await completeGoogleSignIn(pendingGoogleToken, consents, captchaToken);
  };

  const handleGoogleConsentCancel = () => {
    setGoogleConsentOpen(false);
    setPendingGoogleToken(null);
  };

  const submitGoogleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleLinkToken || !linkPassword) return;
    if (CAPTCHA_ENABLED && !linkCaptchaToken) {
      setError('Complete the security check below.');
      focusError();
      return;
    }
    setError('');
    setGoogleSubmitting(true);
    try {
      const data = await authApi.confirmGoogleLink(
        googleLinkToken,
        linkPassword,
        rememberMe,
        linkCaptchaToken ?? undefined,
      );
      setGoogleLinkToken(null);
      clearPendingGoogleLink();
      setLinkPassword('');
      setLinkCaptchaToken(null);
      linkCaptchaRef.current?.reset();
      setUser(data.user);
    } catch {
      setError(GENERIC_LOGIN_ERROR);
      linkCaptchaRef.current?.reset();
      setLinkCaptchaToken(null);
      focusError();
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <LoginPageShell>
      <PageMeta title={`${LOGIN_SUBMIT_LABEL} — ${LOGIN_BRAND}`} />

      <div className="w-full rounded-2xl border border-gray-100/80 bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.07)] sm:p-10">
        <div className="mb-8">
          <Link
            to="/"
            className="text-[#022c22] font-bold text-[1.35rem] tracking-tight hover:opacity-90 transition-opacity"
          >
            {LOGIN_BRAND}
          </Link>
          <p className="mt-1.5 text-[10px] font-medium tracking-[0.2em] text-gray-400 uppercase">
            {LOGIN_TAGLINE}
          </p>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
            {LOGIN_WELCOME}
          </h1>
          <p className="text-sm text-gray-500">{LOGIN_SUBTITLE}</p>
        </div>

        {sessionExpired && (
          <div
            role="status"
            className="mb-5 px-4 py-3 rounded-xl bg-[#022c22]/10 border border-[#022c22]/20 text-gray-800 text-sm"
          >
            Your session expired. Please sign in again.
          </div>
        )}

        {error && (
          <div
            ref={errorRef}
            role="alert"
            aria-live="polite"
            tabIndex={-1}
            className="mb-5 px-4 py-3 rounded-xl bg-error-container border border-error text-on-error-container text-sm outline-none"
          >
            {error}
          </div>
        )}

        <div className="mb-5 space-y-5">
          <LoginGoogleButton
            label={LOGIN_GOOGLE_LABEL}
            disabled={busy}
            loading={googleSubmitting}
            onCredential={handleGoogle}
            onError={() => {
              setError(GENERIC_GOOGLE_ERROR);
              focusError();
            }}
          />

          {googleLinkToken && (
            <form onSubmit={submitGoogleLink} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-700">
                This email already has a password. Confirm it to link Google sign-in.
              </p>
              <p className="text-xs text-gray-500">
                If you refresh this page, sign in with Google again to continue linking.
              </p>
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                placeholder="Account password"
                value={linkPassword}
                onChange={e => setLinkPassword(e.target.value)}
                disabled={busy}
                required
              />
              {CAPTCHA_ENABLED && (
                <RecaptchaBlock
                  ref={linkCaptchaRef}
                  onChange={setLinkCaptchaToken}
                />
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || !linkPassword}
                  className="flex-1 rounded-xl bg-[#022c22] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Link Google
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setGoogleLinkToken(null);
                    clearPendingGoogleLink();
                    setLinkPassword('');
                    setLinkCaptchaToken(null);
                    linkCaptchaRef.current?.reset();
                    setError('');
                  }}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">{LOGIN_DIVIDER}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        {showTwoFactorStep ? (
          <form onSubmit={submitTwoFactor} className="space-y-5" noValidate>
            <p className="text-sm text-gray-600">
              Enter the 6-digit code from your authenticator app to finish signing in.
            </p>
            <OtpInput
              value={twoFactorCode}
              onChange={setTwoFactorCode}
              length={6}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || twoFactorCode.length !== 6}
              className="w-full bg-[#022c22] hover:bg-[#011b16] text-white py-3.5 px-4 rounded-xl font-medium text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
            >
              {actionLoading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <>
                  Verify & sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelTwoFactor}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Back to password
            </button>
          </form>
        ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-semibold text-gray-700">
              {LOGIN_EMAIL_LABEL}
            </label>
            <input
              className={inputClass}
              id="email"
              name="email"
              placeholder={LOGIN_EMAIL_PLACEHOLDER}
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-semibold text-gray-700">
                {LOGIN_PASSWORD_LABEL}
              </label>
              <Link
                className="text-xs text-[#10b981] font-medium hover:underline"
                to="/forgot-password"
              >
                {LOGIN_FORGOT_PASSWORD}
              </Link>
            </div>
            <div className="relative">
              <input
                className={`${inputClass} pr-11`}
                id="password"
                name="password"
                placeholder="••••••••"
                required
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={set('password')}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                disabled={busy}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-60"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {showCaptcha && (
            <WordCaptchaField
              key={captchaKey}
              value={captchaToken}
              onChange={setCaptchaToken}
              disabled={busy}
            />
          )}

          <div className="flex items-center pt-1">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              disabled={busy}
              className="w-4 h-4 text-[#022c22] border-gray-300 rounded focus:ring-[#022c22] cursor-pointer disabled:opacity-60"
            />
            <label htmlFor="remember" className="ml-2.5 block text-sm text-gray-600 cursor-pointer">
              {LOGIN_REMEMBER_LABEL}
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#022c22] hover:bg-[#011b16] text-white py-3.5 px-4 rounded-xl font-medium text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
          >
            {emailSubmitting ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <>
                {LOGIN_SUBMIT_LABEL}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
        )}

        <p className="mt-8 text-center text-sm text-gray-500">
          {LOGIN_FOOTER_PREFIX}{' '}
          <Link
            className="font-semibold text-[#b8956a] hover:text-[#a68459] hover:underline transition-colors"
            to="/signup"
          >
            {LOGIN_FOOTER_CTA}
          </Link>
        </p>
      </div>

      <GoogleConsentSheet
        open={googleConsentOpen}
        busy={googleSubmitting}
        onCancel={handleGoogleConsentCancel}
        onSubmit={handleGoogleConsentSubmit}
      />
    </LoginPageShell>
  );
}
