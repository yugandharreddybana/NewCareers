/**
 * Legacy /reset-password route — OTP flow lives on /forgot-password.
 */
import { Navigate, useLocation } from 'react-router-dom';

type ResetLocationState = { step?: 'verify'; email?: string } | null;

export default function ResetPasswordPage() {
  const location = useLocation();
  const state = (location.state as ResetLocationState) ?? null;
  const email = state?.email?.trim() ?? '';

  return (
    <Navigate
      to="/forgot-password"
      replace
      state={email ? { step: 'verify' as const, email } : { step: 'verify' as const }}
    />
  );
}
