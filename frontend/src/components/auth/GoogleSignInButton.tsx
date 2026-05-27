/**
 * Google Sign-In via Google Identity Services (ID token → backend /auth/google).
 */
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Loader2 } from 'lucide-react';
import { GOOGLE_AUTH_ENABLED } from '@/lib/env';

export type GoogleButtonMode = 'signin' | 'signup';

type Props = {
  mode: GoogleButtonMode;
  disabled?: boolean;
  loading?: boolean;
  onCredential: (idToken: string) => void | Promise<void>;
  onError?: (message: string) => void;
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
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

export function GoogleSignInButton({ mode, disabled, loading, onCredential, onError }: Props) {
  const label = mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google';

  if (!GOOGLE_AUTH_ENABLED) {
    return (
      <button
        type="button"
        disabled
        title="Set VITE_GOOGLE_CLIENT_ID in .env.local to enable Google Sign-In"
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded border border-outline-variant bg-surface-container-lowest text-on-surface-variant font-label-md text-label-md opacity-60 cursor-not-allowed"
      >
        <GoogleIcon />
        {label}
      </button>
    );
  }

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md text-label-md opacity-60"
      >
        <Loader2 size={18} className="animate-spin" />
        Connecting…
      </button>
    );
  }

  return (
    <div className="w-full google-signin-host flex justify-center min-h-[44px]">
      <GoogleLogin
        theme="outline"
        size="large"
        shape="rectangular"
        text={mode === 'signup' ? 'signup_with' : 'signin_with'}
        width="400"
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
