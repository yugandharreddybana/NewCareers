/**
 * Forgot password — email → 8-digit OTP → new password (end-to-end with backend).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OtpInput } from '@/components/auth/OtpInput';
import { Link, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageMeta } from '@/components/PageMeta';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { legalPaths } from '@/lib/brand';
import {
  evaluatePasswordStrength,
  isPasswordComplexityValid,
  passwordComplexityHint,
} from '@/lib/passwordRules';
import {
  GENERIC_FORGOT_SUCCESS,
  GENERIC_RESET_ERROR,
} from '@/lib/authErrors';

type Step = 'email' | 'verify' | 'done';

const RESEND_COOLDOWN_SEC = 60;

type LocationState = { step?: Step; email?: string } | null;

export default function ForgotPasswordPage() {
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;
  const { forgotPassword, resetPassword } = useAuth();

  const [step, setStep] = useState<Step>(state?.step === 'verify' ? 'verify' : 'email');
  const [email, setEmail] = useState(state?.email ?? '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResendCooldown(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  const sendOtp = useCallback(
    async (targetEmail: string, options?: { silent?: boolean }) => {
      if (!options?.silent) setError('');
      setResendLoading(true);
      try {
        await forgotPassword(targetEmail.trim());
        setResendCooldown(RESEND_COOLDOWN_SEC);
        setError('');
        return true;
      } catch {
        setError(GENERIC_FORGOT_SUCCESS);
        setResendCooldown(RESEND_COOLDOWN_SEC);
        return true;
      } finally {
        setResendLoading(false);
      }
    },
    [forgotPassword],
  );

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await sendOtp(email);
    setLoading(false);
    if (ok) {
      setStep('verify');
      setOtp('');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    await sendOtp(email, { silent: true });
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 8) {
      setError('Enter the 8-digit code from your email.');
      return;
    }
    if (!isPasswordComplexityValid(password)) {
      setError(passwordComplexityHint());
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim(), otp, password);
      setStep('done');
    } catch {
      setError(GENERIC_RESET_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      footer={
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 text-on-surface-variant font-label-sm text-label-sm border-t border-outline-variant/50 pt-6">
          <span>© {new Date().getFullYear()} NewCareers AI. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to={legalPaths.privacy} className="hover:text-on-surface transition-colors">
              Privacy Policy
            </Link>
            <Link to={legalPaths.terms} className="hover:text-on-surface transition-colors">
              Terms of Service
            </Link>
            <Link to={legalPaths.help} className="hover:text-on-surface transition-colors">
              Help Center
            </Link>
          </div>
        </footer>
      }
    >
      <PageMeta title={step === 'done' ? 'Password updated' : 'Reset your password'} />

      <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]" aria-hidden="true">
                  lock_reset
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="font-headline-md text-headline-md text-on-surface">
                  {step === 'done' ? 'Password updated' : 'Reset your password'}
                </h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {step === 'email' &&
                    "Enter your email address and we'll send you an 8-digit code to reset your password."}
                  {step === 'verify' &&
                    `Enter the code we sent to ${email} and choose a new password.`}
                  {step === 'done' && 'Your password has been updated. You can sign in with your new password.'}
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="px-4 py-3 rounded bg-error-container border border-error text-on-error-container text-body-sm"
              >
                {error}
              </div>
            )}

            {step === 'email' && (
              <form onSubmit={submitEmail} className="flex flex-col gap-5" noValidate>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface" htmlFor="email">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 pr-10 bg-surface-container-lowest border border-outline-variant rounded text-on-surface font-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline"
                    />
                    <span
                      className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none"
                      aria-hidden="true"
                    >
                      mail
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded bg-primary hover:bg-primary/90 text-on-primary font-label-md transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      Send verification code
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={submitReset} className="flex flex-col gap-5" noValidate>
                <div className="flex flex-col gap-2">
                  <span className="font-label-sm text-label-sm text-on-surface text-center">
                    Verification code
                  </span>
                  <OtpInput value={otp} onChange={setOtp} disabled={loading} />
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || resendLoading}
                      className="font-label-sm text-label-sm text-primary hover:underline disabled:text-on-surface-variant disabled:no-underline disabled:cursor-not-allowed"
                    >
                      {resendLoading
                        ? 'Sending…'
                        : resendCooldown > 0
                          ? `Resend code in ${resendCooldown}s`
                          : 'Resend code'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface" htmlFor="new-password">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 bg-surface-container-lowest border border-outline-variant rounded text-on-surface font-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPw ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {password.length > 0 && strength.label && (
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{strength.label}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface" htmlFor="confirm-password">
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded text-on-surface font-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded bg-primary hover:bg-primary/90 text-on-primary font-label-md transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      Reset password
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        check
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setError('');
                  }}
                  className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
                >
                  Use a different email
                </button>
              </form>
            )}

            {step === 'done' && (
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded bg-primary hover:bg-primary/90 text-on-primary font-label-md transition-colors"
              >
                Sign in
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  arrow_forward
                </span>
              </Link>
            )}

            {step !== 'done' && (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface -mt-2"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  arrow_back
                </span>
                Back to Sign In
              </Link>
            )}
          </div>

      <div className="flex items-center justify-center gap-6 mt-8 text-on-surface-variant">
        <div className="flex items-center gap-1.5 font-label-sm text-label-sm uppercase tracking-wide">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            verified_user
          </span>
          Secure SSL
        </div>
        <div className="flex items-center gap-1.5 font-label-sm text-label-sm uppercase tracking-wide">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            lock
          </span>
          Encrypted
        </div>
      </div>
    </AuthPageShell>
  );
}
