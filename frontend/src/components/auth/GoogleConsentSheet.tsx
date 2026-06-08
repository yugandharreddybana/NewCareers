/**
 * Consent sheet for Google sign-in from /login when terms were not collected on /signup.
 */
import { useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CAPTCHA_ENABLED, RecaptchaBlock } from '@/components/auth/RecaptchaBlock';
import { legalPaths } from '@/lib/brand';
import type { SignupConsents } from '@/lib/pendingSignup';

type GoogleConsentSheetProps = {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (consents: SignupConsents, captchaToken: string | null) => void;
};

export function GoogleConsentSheet({ open, busy, onCancel, onSubmit }: GoogleConsentSheetProps) {
  const captchaRef = useRef<ReCAPTCHA>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [aiProcessingAccepted, setAiProcessingAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [analyticsAccepted, setAnalyticsAccepted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    if (CAPTCHA_ENABLED && !captchaToken) {
      setError('Complete the security check below.');
      return;
    }
    onSubmit(
      { termsAccepted, aiProcessingAccepted, marketingAccepted, analyticsAccepted },
      captchaToken,
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#022c22]/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-consent-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 id="google-consent-title" className="text-xl font-semibold text-gray-900 pr-8">
          Finish setting up your account
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Before we create your CareerOps account with Google, please review and accept our policies.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              disabled={busy}
            />
            <span className="text-sm text-gray-600">
              I agree to the{' '}
              <Link to={legalPaths.terms} className="text-[#022c22] underline" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to={legalPaths.privacy} className="text-[#022c22] underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300"
              checked={aiProcessingAccepted}
              onChange={e => setAiProcessingAccepted(e.target.checked)}
              disabled={busy}
            />
            <span className="text-sm text-gray-600">
              I consent to AI processing of my CV and profile (optional).
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300"
              checked={marketingAccepted}
              onChange={e => setMarketingAccepted(e.target.checked)}
              disabled={busy}
            />
            <span className="text-sm text-gray-600">Send me product tips and job digest emails (optional).</span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300"
              checked={analyticsAccepted}
              onChange={e => setAnalyticsAccepted(e.target.checked)}
              disabled={busy}
            />
            <span className="text-sm text-gray-600">Help improve CareerOps with anonymous usage analytics (optional).</span>
          </label>

          {CAPTCHA_ENABLED && (
            <RecaptchaBlock
              ref={captchaRef}
              onChange={setCaptchaToken}
              onExpired={() => setCaptchaToken(null)}
            />
          )}

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#022c22] py-3 text-sm font-medium text-white hover:bg-[#033d2e] disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : 'Continue with Google'}
          </button>
        </form>
      </div>
    </div>
  );
}
