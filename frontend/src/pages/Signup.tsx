/**
 * Signup.tsx — account creation page.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { useAuth } from '@/context/AuthContext';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { isApiError } from '@/types';

type StrengthLabel = '' | 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';

interface Strength {
  label: StrengthLabel;
  color: string;
  acceptable: boolean;
}

function evaluatePassword(p: string): Strength {
  if (!p) return { label: '', color: '', acceptable: false };
  if (p.length < 8) return { label: 'Too short', color: 'text-red-600', acceptable: false };

  let score = 0;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (p.length >= 12) score++;

  if (score <= 1) return { label: 'Weak', color: 'text-red-600', acceptable: false };
  if (score === 2) return { label: 'Fair', color: 'text-amber-600', acceptable: false };
  if (score === 3) return { label: 'Good', color: 'text-primary', acceptable: true };
  return { label: 'Strong', color: 'text-emerald-600', acceptable: true };
}

const inputClass =
  'w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow placeholder:text-outline';

export default function Signup() {
  const { signUp, signInWithGoogle, actionLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const strength = evaluatePassword(password);

  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    return () => {
      document.documentElement.classList.remove('light');
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!strength.acceptable) {
      setError(
        password.length === 0
          ? 'Please choose a password.'
          : 'Password is too weak. Use at least 8 characters with a mix of upper-case letters, numbers, and symbols.',
      );
      return;
    }

    try {
      await signUp({ name: name.trim(), email: email.trim(), password });
      navigate('/onboarding', { replace: true });
    } catch (err: unknown) {
      if (isApiError(err)) {
        setError(err.normalizedMessage || 'Sign up failed. Please try again.');
      } else if (err instanceof Error) {
        setError(err.message || 'Sign up failed. Please try again.');
      } else {
        setError('Sign up failed. Please try again.');
      }
    }
  };

  const handleGoogle = async (idToken: string) => {
    setError('');
    try {
      const user = await signInWithGoogle(idToken);
      navigate(user.onboarded ? '/dashboard' : '/onboarding', { replace: true });
    } catch (err: unknown) {
      if (isApiError(err)) {
        setError(err.normalizedMessage || 'Google sign-up failed.');
      } else if (err instanceof Error) {
        setError(err.message || 'Google sign-up failed.');
      } else {
        setError('Google sign-up failed.');
      }
    }
  };

  return (
    <div className="bg-surface-container-low min-h-screen flex items-center justify-center p-margin-mobile md:p-margin-desktop antialiased text-on-surface w-full">
      <PageMeta title="Create Account — NewCareers" />

      <main className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">NewCareers</h1>
        </div>

        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm p-6 md:p-8 flex flex-col gap-6">
          <div className="text-center flex flex-col gap-2">
            <h2 className="font-headline-md text-headline-md text-on-surface">Create your account</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Join NewCareers to elevate your professional path.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <GoogleSignInButton
              mode="signup"
              disabled={actionLoading}
              loading={actionLoading}
              onCredential={handleGoogle}
              onError={msg => setError(msg)}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-outline-variant/50" />
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              or continue with email
            </span>
            <div className="flex-1 h-px bg-outline-variant/50" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
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
              <label className="font-label-sm text-label-sm text-on-surface" htmlFor="name">
                Full Name
              </label>
              <input
                className={inputClass}
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface" htmlFor="email">
                Email Address
              </label>
              <input
                className={inputClass}
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface" htmlFor="password">
                Password
              </label>
              <input
                className={inputClass}
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-describedby="password-strength"
              />
              {password && (
                <p id="password-strength" className={`mt-1.5 text-xs font-semibold ${strength.color}`} aria-live="polite">
                  Password strength: {strength.label}
                  {!strength.acceptable && password.length >= 8 && ' — add upper-case, digits, or symbols.'}
                </p>
              )}
            </div>

            <button
              className="w-full py-3 mt-2 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container transition-colors duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              type="submit"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <>
                  Create Account
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Already have an account?{' '}
            <Link className="text-primary font-medium hover:underline hover:text-primary-container transition-colors" to="/login">
              Sign In
            </Link>
          </p>
          <p className="mt-4 text-on-surface-variant text-xs leading-relaxed max-w-[320px] mx-auto">
            By creating an account you agree to our{' '}
            <Link to="/legal/terms" className="underline hover:text-primary">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/legal/privacy" className="underline hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
