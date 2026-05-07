/**
 * ResetPasswordPage.tsx — set a new password from an email link.
 *
 * Pass 6 #6.038 / #6.044 — split out from the previous combined PasswordRecovery
 * page so the URL ↔ flow mapping is unambiguous.
 *
 * Pass 6 (carried-over correctness fix) — the previous PasswordRecovery
 * called `resetPassword(password, token)` with arguments swapped relative to
 * the AuthContext signature `resetPassword(token, newPassword)`. Fixed here.
 *
 * Strict guard: if the URL has no `?token=...` we redirect to /forgot-password
 * before any state is established.
 */
import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  Zap, ArrowLeft, Lock, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageMeta } from '@/components/PageMeta';
import { isApiError } from '@/types';

interface PwStrength { score: number; label: string; color: string; }

function getPasswordStrength(pw: string): PwStrength {
  if (pw.length === 0) return { score: 0, label: '',           color: '' };
  if (pw.length < 8)   return { score: 1, label: 'Too short',  color: 'bg-red-500' };
  let score = 1;
  if (/[A-Z]/.test(pw))            score++;
  if (/[0-9]/.test(pw))            score++;
  if (/[^A-Za-z0-9]/.test(pw))     score++;
  const labels = ['', 'Too short', 'Weak', 'Fair', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];
  return { score, label: labels[score] ?? '', color: colors[score] ?? '' };
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { resetPassword } = useAuth();
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [done, setDone]                       = useState(false);
  const [error, setError]                     = useState('');

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  // Strict guard — must have a token. Hooks above are unconditional.
  if (!token) return <Navigate to="/forgot-password" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (strength.score < 3) {
      setError('Password is too weak. Add upper-case letters, numbers, or symbols.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      const msg = isApiError(err)
        ? err.normalizedMessage
        : err instanceof Error ? err.message : '';
      const lower = msg.toLowerCase();
      if (lower.includes('expired') || lower.includes('invalid') || lower.includes('token')) {
        setError('This reset link has expired or is invalid. Please request a new one.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <PageMeta title="Set New Password" />

      <div className="hidden lg:flex lg:w-[45%] flex-col bg-slate-900 px-12 py-14 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/10 pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-emerald-500/5 pointer-events-none" />

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
            <Zap size={17} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-lg text-white">Career<span className="text-emerald-400">Ops</span></span>
        </div>

        <div className="my-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Lock size={30} className="text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white leading-tight">
            Secure your<br /><span className="text-emerald-400">account.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Set a strong new password to keep your profile and career analysis safe.
          </p>
        </div>

        <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} CareerOps</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Zap size={15} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-slate-900">Career<span className="text-emerald-500">Ops</span></span>
          </div>

          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Password reset!</h2>
              <p className="text-slate-400 text-sm mb-8">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                <ArrowLeft size={15} /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Set new password</h2>
              <p className="text-slate-400 text-sm mb-8">Enter a strong new password below.</p>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                  {error.toLowerCase().includes('expired') && (
                    <Link to="/forgot-password" className="ml-auto shrink-0 font-semibold underline text-red-700 hover:text-red-800">
                      Get new link
                    </Link>
                  )}
                </div>
              )}

              <form onSubmit={submit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 h-12 rounded-xl border border-slate-200 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 transition-all bg-white"
                  />
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              i <= strength.score ? strength.color : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${
                        strength.score <= 1 ? 'text-red-500'
                        : strength.score === 2 ? 'text-orange-500'
                        : strength.score === 3 ? 'text-yellow-600'
                        : 'text-emerald-600'
                      }`}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 h-12 rounded-xl border border-slate-200 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 transition-all bg-white"
                  />
                  {confirmPassword.length > 0 && (
                    <p className={`mt-1 text-xs font-medium ${
                      password === confirmPassword ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={17} className="animate-spin" /> : 'Set password'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 font-medium transition-colors"
                >
                  <ArrowLeft size={14} /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
