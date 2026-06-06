/**
 * Signup.tsx — account creation page.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Loader2 } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { SignupPageShell } from '@/components/auth/SignupPageShell';
import { legalPaths } from '@/lib/brand';
import { authApi } from '@/services/api';
import { clearOnboardingVerification } from '@/lib/onboardingVerification';
import { clearPendingSignup, writePendingSignup } from '@/lib/pendingSignup';
import { tokenStore } from '@/lib/tokenStore';
import { isApiError } from '@/types';
import { writePendingGoogleConsents } from '@/lib/pendingGoogleConsents';
import { writeAnalyticsConsent } from '@/lib/cookieConsent';

type StrengthLabel = '' | 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';

interface Strength {
  label: StrengthLabel;
  acceptable: boolean;
}

function evaluatePassword(p: string): Strength {
  if (!p) return { label: '', acceptable: false };
  if (p.length < 8) return { label: 'Too short', acceptable: false };

  let score = 0;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (p.length >= 12) score++;

  if (score <= 1) return { label: 'Weak', acceptable: false };
  if (score === 2) return { label: 'Fair', acceptable: false };
  if (score === 3) return { label: 'Good', acceptable: true };
  return { label: 'Strong', acceptable: true };
}

function isDuplicateEmailError(err: unknown): boolean {
  if (isAxiosError(err) && err.response?.status === 409) return true;
  if (isApiError(err) && err.normalizedMessage.toLowerCase().includes('already exists')) return true;
  return false;
}

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';

  useEffect(() => {
    if (!sessionExpired) return;
    tokenStore.clear();
    clearPendingSignup();
    clearOnboardingVerification();
    void authApi.logout().catch(() => {
      /* clear HttpOnly cookies best-effort */
    });
  }, [sessionExpired]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [aiProcessingAccepted, setAiProcessingAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [analyticsAccepted, setAnalyticsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strength = evaluatePassword(password);
  const busy = submitting;

  const buildConsents = () => ({
    termsAccepted,
    aiProcessingAccepted,
    marketingAccepted,
    analyticsAccepted,
  });

  const validateConsents = (): string | null => {
    if (!termsAccepted) {
      return 'You must accept the Terms of Service and Privacy Policy to continue.';
    }
    return null;
  };

  const persistConsents = () => {
    const consents = buildConsents();
    writePendingGoogleConsents(consents);
    writeAnalyticsConsent(analyticsAccepted);
  };

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
    const consentError = validateConsents();
    if (consentError) {
      setError(consentError);
      return;
    }

    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      await authApi.checkSignupEmail(trimmedEmail);

      const consents = buildConsents();
      persistConsents();
      writePendingSignup({
        email: trimmedEmail,
        password,
        ...(name.trim() ? { name: name.trim() } : {}),
        consents,
      });
      navigate('/onboarding', { replace: true });
    } catch (err: unknown) {
      if (isDuplicateEmailError(err)) {
        setError('An account is already associated with this email.');
        return;
      }
      setError('Could not continue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SignupPageShell>
      <PageMeta title="CareerOps - Sign Up" />

      <div className="flex flex-col gap-2">
        <div className="mb-4 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[28px] text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden
          >
            hexagon
          </span>
          <Link
            to="/"
            className="font-headline-lg text-headline-lg tracking-tight text-on-surface hover:opacity-90 transition-opacity"
          >
            CareerOps
          </Link>
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface">Sign up</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Set your login details, then complete your profile to create your account.
        </p>
      </div>

      {sessionExpired && (
        <div
          role="status"
          className="mb-4 rounded border border-primary/20 bg-primary/5 px-4 py-3 text-body-md text-on-surface"
        >
          Your sign-up session expired. Please enter your details again to continue.
        </div>
      )}

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded border border-error bg-error-container px-4 py-3 text-body-md text-on-error-container"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-label-md text-on-surface" htmlFor="name">
              Full Name
            </label>
            <input
              className="custom-input rounded"
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Doe"
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-label-md text-label-md text-on-surface" htmlFor="email">
              Email Address
            </label>
            <input
              className="custom-input rounded"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              placeholder="jane@example.com"
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-label-md text-label-md text-on-surface" htmlFor="password">
              Password
            </label>
            <input
              className="custom-input rounded"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={busy}
            />
            {password.length > 0 && strength.label && (
              <p
                className="font-label-sm text-label-sm text-on-surface-variant"
                aria-live="polite"
              >
                {strength.label}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-surface-variant bg-surface-container-low p-5">
          <label className="group flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="custom-checkbox mt-[2px]"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              disabled={busy}
              required
            />
            <span className="font-body-md text-body-md text-on-surface-variant transition-colors group-hover:text-on-surface">
              I agree to the{' '}
              <Link
                to={legalPaths.terms}
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to={legalPaths.privacy}
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </Link>
            </span>
          </label>

          <div className="h-px w-full bg-surface-variant" />

          <label className="group flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="custom-checkbox mt-[2px]"
              checked={aiProcessingAccepted}
              onChange={e => setAiProcessingAccepted(e.target.checked)}
              disabled={busy}
            />
            <span className="font-body-md text-body-md leading-relaxed text-on-surface-variant transition-colors group-hover:text-on-surface">
              I consent to AI processing of my CV and profile by third-party providers (Anthropic,
              Google, NVIDIA) for job matching and career skills{' '}
              <span className="text-secondary">
                (optional — enable later in Account settings)
              </span>
              .
            </span>
          </label>

          <label className="group flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="custom-checkbox mt-[2px]"
              checked={marketingAccepted}
              onChange={e => setMarketingAccepted(e.target.checked)}
              disabled={busy}
            />
            <span className="font-body-md text-body-md text-on-surface-variant transition-colors group-hover:text-on-surface">
              Send me product tips and job digest emails{' '}
              <span className="text-secondary">(optional)</span>
            </span>
          </label>

          <label className="group flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="custom-checkbox mt-[2px]"
              checked={analyticsAccepted}
              onChange={e => setAnalyticsAccepted(e.target.checked)}
              disabled={busy}
            />
            <span className="font-body-md text-body-md text-on-surface-variant transition-colors group-hover:text-on-surface">
              Help improve CareerOps with anonymous usage analytics{' '}
              <span className="text-secondary">(optional)</span>
            </span>
          </label>
        </div>

        <button
          className="btn-primary mt-2 flex w-full items-center justify-center gap-2 rounded py-3 font-label-md text-label-md"
          type="submit"
          disabled={busy}
        >
          {submitting ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <>
              Continue to profile
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                arrow_forward
              </span>
            </>
          )}
        </button>
      </form>

      <div className="mt-2 text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">
          Already have an account?{' '}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            to="/login"
          >
            Sign In
          </Link>
        </p>
      </div>
    </SignupPageShell>
  );
}
