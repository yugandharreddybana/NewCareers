/**
 * Login.tsx — sign-in page.
 *
 * Pass 6 fixes folded in:
 *   #6.002          — switches to the canonical `/signup` route.
 *   #6.003          — DEV_BYPASS only honoured when `VITE_DEV_BYPASS_GUARDS=true`;
 *                    no more silent dev-mode bypass.
 *   #6.015          — dead "Continue with Google" button removed (OAuth not
 *                    implemented). Re-add after backend SSO ships.
 *   #6.016          — social-proof stats now come from `/public/stats`.
 *   #6.017          — surfaces `err.normalizedMessage` from the axios interceptor.
 *   #6.018          — single redirect via a `redirected` ref; no flicker on
 *                    rapid auth-state changes.
 *   #6.037          — `lib/env.ts` is the single source of truth for env flags.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageMeta } from '@/components/PageMeta';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { isApiError } from '@/types';

export default function Login() {
  const { signIn, signInWithGoogle, user, actionLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pass 6 #6.018 — redirect-once gate: prevents double-navigate races.
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    if (!user) return;
    redirected.current = true;
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    const target = from ?? (user.onboarded ? '/dashboard' : '/onboarding');
    navigate(target, { replace: true });
  }, [user, navigate, location.state]);

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(form.email, form.password);
      // Effect above handles navigation on user state change.
    } catch (err: unknown) {
      // Pass 6 #6.017 — prefer the normalised message from the axios interceptor.
      if (isApiError(err)) {
        setError(err.normalizedMessage || 'Invalid email or password.');
      } else if (err instanceof Error) {
        setError(err.message || 'Invalid email or password.');
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (idToken: string) => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle(idToken);
    } catch (err: unknown) {
      if (isApiError(err)) {
        setError(err.normalizedMessage || 'Google sign-in failed.');
      } else if (err instanceof Error) {
        setError(err.message || 'Google sign-in failed.');
      } else {
        setError('Google sign-in failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container-low min-h-screen flex items-center justify-center p-margin-mobile md:p-margin-desktop antialiased text-on-surface w-full">
      <PageMeta title="Sign In" />

      <main className="w-full max-w-[440px]">
        {/* Brand Header (Standalone for Transactional Page) */}
        <div className="text-center mb-8">
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">NewCareers</h1>
        </div>

        {/* Authentication Card */}
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm p-6 md:p-8 flex flex-col gap-6">
          <div className="text-center flex flex-col gap-2">
            <h2 className="font-headline-md text-headline-md text-on-surface">Welcome back</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Please enter your details to sign in.</p>
          </div>

          <div className="flex flex-col gap-3">
            <GoogleSignInButton
              mode="signin"
              disabled={submitting}
              loading={actionLoading}
              onCredential={handleGoogle}
              onError={msg => setError(msg)}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-outline-variant/50"></div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              or continue with email
            </span>
            <div className="flex-1 h-px bg-outline-variant/50"></div>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="px-4 py-3 rounded bg-error-container border border-error text-on-error-container text-body-sm font-body-sm"
              >
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface" htmlFor="email">
                Email Address
              </label>
              <input
                className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow placeholder:text-outline"
                id="email"
                name="email"
                placeholder="Enter your email"
                required
                type="email"
                value={form.email}
                onChange={set('email')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-on-surface" htmlFor="password">
                  Password
                </label>
                <Link
                  className="font-label-sm text-label-sm text-primary hover:text-primary-container hover:underline transition-colors"
                  to="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow placeholder:text-outline pr-10"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface-container-lowest"
                  name="remember"
                  type="checkbox"
                />
                <span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                  Remember me
                </span>
              </label>
            </div>

            <button
              className="w-full py-3 mt-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary-container transition-colors duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <>
                  Sign In
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]" data-icon="arrow_forward">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Links */}
        <div className="text-center mt-6">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Don't have an account?{' '}
            <Link className="text-primary font-medium hover:underline hover:text-primary-container transition-colors" to="/get-started">
              Get Started
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
