/**
 * Login.tsx — sign-in page with Remember Me, jumbled word CAPTCHA below password, and session-expired banner.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageMeta } from '@/components/PageMeta';
import { LoginPageShell } from '@/components/auth/LoginPageShell';
import { LoginGoogleButton } from '@/components/auth/LoginGoogleButton';
import { WordCaptchaField } from '@/components/auth/WordCaptchaField';
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
import { LOGIN_WORD_CAPTCHA_REQUIRED } from '@/lib/env';
import { isApiError } from '@/types';

const inputClass =
  'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#022c22]/15 focus:border-[#022c22] transition-colors placeholder:text-gray-400 disabled:opacity-60';

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const prefillEmail = searchParams.get('email')?.trim() ?? '';

  const [form, setForm] = useState(() => ({
    email: prefillEmail,
    password: '',
  }));
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const email = searchParams.get('email')?.trim() ?? '';
    if (email) {
      setForm(f => (f.email === email ? f : { ...f, email }));
    }
  }, [searchParams]);

  const busy = emailSubmitting || googleSubmitting;

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

    if (LOGIN_WORD_CAPTCHA_REQUIRED && !captchaToken) {
      setError('Please enter the security check characters.');
      focusError();
      return;
    }

    setEmailSubmitting(true);
    try {
      await signIn(form.email, form.password, {
        rememberMe,
        ...(LOGIN_WORD_CAPTCHA_REQUIRED && captchaToken ? { captchaToken } : {}),
      });
    } catch (err: unknown) {
      if (isApiError(err)) {
        setError(err.normalizedMessage || 'Invalid email or password.');
      } else if (err instanceof Error) {
        setError(err.message || 'Invalid email or password.');
      } else {
        setError('Invalid email or password.');
      }
      if (LOGIN_WORD_CAPTCHA_REQUIRED) refreshCaptcha();
      focusError();
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleGoogle = async (idToken: string) => {
    setError('');
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle(idToken, rememberMe);
    } catch (err: unknown) {
      if (isApiError(err)) {
        setError(err.normalizedMessage || 'Google sign-in failed.');
      } else if (err instanceof Error) {
        setError(err.message || 'Google sign-in failed.');
      } else {
        setError('Google sign-in failed.');
      }
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

        <div className="mb-5 space-y-5">
          <LoginGoogleButton
            label={LOGIN_GOOGLE_LABEL}
            disabled={busy}
            loading={googleSubmitting}
            onCredential={handleGoogle}
            onError={msg => setError(msg)}
          />

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">{LOGIN_DIVIDER}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5" noValidate>
          {error && (
            <div
              ref={errorRef}
              role="alert"
              aria-live="polite"
              tabIndex={-1}
              className="px-4 py-3 rounded-xl bg-error-container border border-error text-on-error-container text-sm outline-none"
            >
              {error}
            </div>
          )}

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

          {LOGIN_WORD_CAPTCHA_REQUIRED && (
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
    </LoginPageShell>
  );
}
