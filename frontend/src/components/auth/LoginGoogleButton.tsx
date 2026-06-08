/**
 * Login-page Google button styled to match the split-panel auth design.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { GOOGLE_AUTH_ENABLED } from '@/lib/env';

type Props = {
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  onCredential: (idToken: string) => void | Promise<void>;
  onError?: (message: string) => void;
};

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export function LoginGoogleButton({
  label = 'Continue with Google',
  disabled,
  loading,
  onCredential,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const update = () => setWidth(Math.max(el.offsetWidth, 280));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!GOOGLE_AUTH_ENABLED || loading) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed opacity-60 rounded-xl border border-gray-200 bg-white py-3.5 px-4 shadow-sm"
      >
        <span className="flex items-center justify-between gap-3 text-sm font-medium text-gray-800">
          <span className="flex items-center gap-3">
            {loading ? <Loader2 size={20} className="animate-spin text-gray-400" /> : <GoogleIcon />}
            {label}
          </span>
          <ArrowRight size={16} className="text-gray-500" />
        </span>
      </button>
    );
  }

  return (
    <div
      ref={hostRef}
      className={`relative w-full min-h-[52px] rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <GoogleLogin
        theme="outline"
        size="large"
        shape="rectangular"
        text="continue_with"
        width={width}
        containerProps={{
          className: 'w-full flex justify-center py-1',
          style: { width: '100%' },
        }}
        onSuccess={(response: CredentialResponse) => {
          if (disabled) return;
          const token = response.credential;
          if (!token) {
            onError?.('Google did not return a sign-in token. Please try again.');
            return;
          }
          void Promise.resolve(onCredential(token)).catch(() => {
            onError?.('Google sign-in failed. Please try again.');
          });
        }}
        onError={() => onError?.('Google sign-in was cancelled or blocked.')}
      />
    </div>
  );
}
