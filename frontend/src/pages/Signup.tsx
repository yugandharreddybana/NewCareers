/**
 * Signup.tsx — account creation page.
 *
 * Pass 6 fixes folded in:
 *   #6.001          — calls `signUp({ name, email, password })` (object, not
 *                    positional). Eliminates the swapped-argument class of bug.
 *   #6.019          — `catch (err: unknown)` with type-narrowing helper.
 *   #6.020          — rejects "Fair" passwords client-side; matches the
 *                    backend complexity rule planned for #5.007.
 *   #6.045-adjacent — calls `useAuth().signUp` which now triggers an
 *                    immediate /auth/me hydration on success via the post-set
 *                    user state.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { useAuth } from '@/context/AuthContext';
import { isApiError } from '@/types';

const PERKS = [
  { icon: '🎯', text: 'AI-powered job matching & triage' },
  { icon: '📄', text: 'One-click CV tailoring per job' },
  { icon: '🤝', text: 'Networking pipeline & follow-ups' },
  { icon: '🧠', text: 'Mock interviews with AI feedback' },
];

type StrengthLabel = '' | 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';

interface Strength {
  label: StrengthLabel;
  color: string;
  /** Whether the password is acceptable to submit. */
  acceptable: boolean;
}

/**
 * Mirrors the backend complexity rule: at minimum 8 characters AND at least
 * two of {uppercase, digit, symbol}. Anything below "Good" is rejected.
 */
function evaluatePassword(p: string): Strength {
  if (!p)              return { label: '',           color: '',                  acceptable: false };
  if (p.length < 8)    return { label: 'Too short',  color: 'text-red-500',      acceptable: false };

  let score = 0;
  if (/[A-Z]/.test(p))            score++;
  if (/[0-9]/.test(p))            score++;
  if (/[^A-Za-z0-9]/.test(p))     score++;
  if (p.length >= 12)             score++;

  if (score <= 1) return { label: 'Weak',   color: 'text-red-500',      acceptable: false };
  if (score === 2) return { label: 'Fair',  color: 'text-yellow-500',   acceptable: false };
  if (score === 3) return { label: 'Good',  color: 'text-blue-500',     acceptable: true };
  return            { label: 'Strong',      color: 'text-emerald-500',  acceptable: true };
}

const Signup: React.FC = () => {
  const { signUp, actionLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const strength = evaluatePassword(password);

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

    try {
      await signUp({ name: name.trim(), email: email.trim(), password });
      navigate('/onboarding', { replace: true });
    } catch (err: unknown) {
      if (isApiError(err)) {
        setError(err.normalizedMessage || 'Sign up failed. Please try again.');
      } else if (err instanceof Error) {
        setError(err.message || 'Sign up failed. Please try again.');
      } else {
        setError('Sign up failed. Please try again.');
      }
    }
  };

  return (
    <>
      <PageMeta title="Create Account — CareerOps" />
      <div className="min-h-screen flex">

        {/* Left brand panel */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 bg-slate-900 text-white px-14 py-16">
          <div>
            <p className="text-2xl font-bold tracking-tight text-emerald-400">CareerOps</p>
            <p className="mt-2 text-slate-400 text-sm">Your AI-powered career command centre</p>
          </div>
          <div className="space-y-5">
            <h2 className="text-3xl font-semibold leading-snug">
              Everything you need to<br />land your next role
            </h2>
            <ul className="space-y-4 mt-6">
              {PERKS.map((p) => (
                <li key={p.text} className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden="true">{p.icon}</span>
                  <span className="text-slate-300 text-sm leading-snug">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-slate-500 text-xs">© {new Date().getFullYear()} CareerOps. All rights reserved.</p>
        </div>

        {/* Right form panel */}
        <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
            <p className="mt-1 text-sm text-gray-500">
              Already have one?{' '}
              <Link to="/login" className="text-emerald-600 hover:underline font-medium">Sign in</Link>
            </p>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars; mix upper, number, symbol"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-describedby="password-strength"
                />
                {password && (
                  <p
                    id="password-strength"
                    className={`mt-1 text-xs font-medium ${strength.color}`}
                    aria-live="polite"
                  >
                    Password strength: {strength.label}
                    {!strength.acceptable && password.length >= 8 && ' — add upper-case, digits, or symbols.'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {actionLoading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-gray-400">
              By creating an account you agree to our{' '}
              <Link to="/legal/terms" className="underline">Terms</Link> and{' '}
              <Link to="/legal/privacy" className="underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
