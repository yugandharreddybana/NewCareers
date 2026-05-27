/**
 * Legacy /reset-password route — OTP flow lives on /forgot-password.
 */
import { Navigate, useSearchParams } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';

  return (
    <Navigate
      to="/forgot-password"
      replace
      state={{ step: 'verify' as const, email }}
    />
  );
}
