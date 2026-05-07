/**
 * PasswordRecovery.tsx — DEPRECATED.
 *
 * Pass 6 #6.038 / #6.044 — split into ForgotPasswordPage and ResetPasswordPage.
 * App.tsx now routes `/forgot-password` and `/reset-password` to the dedicated
 * pages. This shim remains so any external link or older import continues to
 * resolve. It dispatches to the right page based on the URL path.
 */
import { useLocation } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';

export default function PasswordRecovery() {
  const { pathname } = useLocation();
  if (pathname === '/reset-password') return <ResetPasswordPage />;
  return <ForgotPasswordPage />;
}
