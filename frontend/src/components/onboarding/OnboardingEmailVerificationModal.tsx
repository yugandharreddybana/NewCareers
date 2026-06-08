import { useCallback, useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import { OtpInput } from '@/components/auth/OtpInput';
import { CAPTCHA_ENABLED, RecaptchaBlock } from '@/components/auth/RecaptchaBlock';
import { authApi } from '@/services/api';
import {
  GENERIC_OTP_ERROR,
  GENERIC_OTP_SEND_ERROR,
  GENERIC_SECURITY_ERROR,
} from '@/lib/authErrors';
import { isApiError } from '@/types';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local[0] ?? '*' : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Props = {
  open: boolean;
  email: string;
  firstName?: string;
  initialResendsRemaining?: number;
  /** When true, modal sends OTP after captcha instead of assuming code was already sent. */
  awaitingInitialSend?: boolean;
  onVerified: (verificationId: string) => void;
  onCancel: () => void;
};

export function OnboardingEmailVerificationModal({
  open,
  email,
  firstName,
  initialResendsRemaining = 3,
  awaitingInitialSend = false,
  onVerified,
  onCancel,
}: Props) {
  const captchaRef = useRef<ReCAPTCHA>(null);
  const [otp, setOtp] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(!awaitingInitialSend);
  const [resendsRemaining, setResendsRemaining] = useState(initialResendsRemaining);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!open) return;
    setOtp('');
    setCaptchaToken(null);
    setError('');
    setResendCooldown(0);
    setResendsRemaining(initialResendsRemaining);
    setOtpSent(!awaitingInitialSend);
    captchaRef.current?.reset();
  }, [open, email, initialResendsRemaining, awaitingInitialSend]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResendCooldown(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  const handleInitialSend = useCallback(async () => {
    setError('');
    if (CAPTCHA_ENABLED && !captchaToken) {
      setError('Complete the security check below.');
      return;
    }
    setSendLoading(true);
    try {
      const body: { email: string; firstName?: string; captchaToken?: string } = { email };
      if (firstName) body.firstName = firstName;
      if (captchaToken) body.captchaToken = captchaToken;
      const resp = await authApi.sendOnboardingVerificationOtp(body);
      setResendsRemaining(resp.resendsRemaining);
      setOtpSent(true);
    } catch {
      setError(GENERIC_OTP_SEND_ERROR);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setSendLoading(false);
    }
  }, [captchaToken, email, firstName]);

  const handleResend = useCallback(async () => {
    setError('');
    if (CAPTCHA_ENABLED && !captchaToken) {
      setError('Complete the security check below.');
      return;
    }
    setResendLoading(true);
    try {
      const resp = await authApi.resendOnboardingVerificationOtp(
        email,
        captchaToken ?? undefined,
      );
      setResendsRemaining(resp.resendsRemaining);
      setResendCooldown(resp.retryAfterSeconds > 0 ? resp.retryAfterSeconds : 300);
      setOtp('');
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } catch (err: unknown) {
      setError(GENERIC_OTP_SEND_ERROR);
      if (isApiError(err) && err.retryAfterSeconds) {
        setResendCooldown(err.retryAfterSeconds);
      }
    } finally {
      setResendLoading(false);
    }
  }, [captchaToken, email]);

  const handleSubmit = useCallback(async () => {
    setError('');
    if (otp.length !== 8) {
      setError('Enter the 8-digit code from your email.');
      return;
    }
    if (CAPTCHA_ENABLED && !captchaToken) {
      setError('Complete the security check below.');
      return;
    }

    setLoading(true);
    try {
      const verifyBody: { email: string; otp: string; captchaToken?: string } = { email, otp };
      if (captchaToken) verifyBody.captchaToken = captchaToken;
      const resp = await authApi.verifyOnboardingEmail(verifyBody);
      onVerified(resp.verificationId);
    } catch (err: unknown) {
      if (isApiError(err) && err.status === 400
          && err.normalizedMessage?.toLowerCase().includes('security')) {
        setError(GENERIC_SECURITY_ERROR);
      } else {
        setError(GENERIC_OTP_ERROR);
      }
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }, [captchaToken, email, onVerified, otp]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#022c22]/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-verify-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 shadow-2xl shadow-[#022c22]/20 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-br from-[#f0fdfa] to-white">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#022c22]/10 text-[#022c22]">
              <Mail size={20} aria-hidden />
            </span>
            <div>
              <h2 id="onboarding-verify-title" className="text-lg font-semibold text-slate-900">
                Verify your email
              </h2>
              <p className="text-sm text-slate-500">
                {otpSent ? 'Code sent to' : 'We will send a code to'}{' '}
                <span className="font-medium text-slate-700">{maskEmail(email)}</span>
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {otpSent
              ? `Enter the 8-digit code from your inbox and complete the security check to finish creating your account${firstName ? `, ${firstName}` : ''}.`
              : `Complete the security check and we will email you an 8-digit verification code${firstName ? `, ${firstName}` : ''}.`}
          </p>
        </div>

        <div className="px-6 py-5 space-y-6">
          {otpSent && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email verification code
              </label>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Resends remaining: {resendsRemaining}</span>
                <button
                  type="button"
                  disabled={resendLoading || resendCooldown > 0 || resendsRemaining <= 0 || loading}
                  onClick={() => void handleResend()}
                  className="font-medium text-[#0d9488] hover:text-[#022c22] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> Sending…
                    </span>
                  ) : resendCooldown > 0 ? (
                    `Resend in ${formatCooldown(resendCooldown)}`
                  ) : resendsRemaining <= 0 ? (
                    'Resend limit reached'
                  ) : (
                    'Resend code'
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck size={14} aria-hidden />
              Security check
            </div>
            <RecaptchaBlock
              ref={captchaRef}
              className="flex justify-center"
              onChange={setCaptchaToken}
              onExpired={() => setCaptchaToken(null)}
            />
            {!CAPTCHA_ENABLED && (
              <p className="text-xs text-center text-slate-400">
                CAPTCHA disabled in development — verification will proceed automatically.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading || sendLoading}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            {!otpSent ? (
              <button
                type="button"
                onClick={() => void handleInitialSend()}
                disabled={sendLoading || (CAPTCHA_ENABLED && !captchaToken)}
                className="flex-1 py-3 rounded-xl bg-[#022c22] hover:bg-[#011b16] text-white text-sm font-medium shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {sendLoading ? <Loader2 size={16} className="animate-spin" /> : 'Send code'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading || otp.length !== 8 || (CAPTCHA_ENABLED && !captchaToken)}
                className="flex-1 py-3 rounded-xl bg-[#022c22] hover:bg-[#011b16] text-white text-sm font-medium shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verify & continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
