import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { useAuth } from '@/context/AuthContext';

const perks = [
  { icon: '🎯', text: 'AI-powered job matching & triage' },
  { icon: '📄', text: 'One-click CV tailoring per job' },
  { icon: '🤝', text: 'Networking pipeline & follow-ups' },
  { icon: '🧠', text: 'Mock interviews with AI feedback' },
];

const strengthLabel = (p: string) => {
  if (!p) return { label: '', color: '' };
  if (p.length < 6) return { label: 'Too short', color: 'text-red-500' };
  let score = 0;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (p.length >= 12) score++;
  if (score <= 1) return { label: 'Weak', color: 'text-red-500' };
  if (score === 2) return { label: 'Fair', color: 'text-yellow-500' };
  if (score === 3) return { label: 'Good', color: 'text-blue-500' };
  return { label: 'Strong', color: 'text-emerald-500' };
};

const Signup: React.FC = () => {
  const { signUp, actionLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const strength = strengthLabel(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (strength.label === 'Too short' || strength.label === 'Weak') {
      setError('Please choose a stronger password.');
      return;
    }
    try {
      await signUp(email, password, name);
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Sign up failed. Please try again.');
    }
  };

  return (
    <>
      <PageMeta title="Create Account — CareerOps" />
      <div className="min-h-screen flex">
        {/* Left panel */}
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
              {perks.map((p) => (
                <li key={p.text} className="flex items-start gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <span className="text-slate-300 text-sm leading-snug">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-slate-500 text-xs">© 2026 CareerOps. All rights reserved.</p>
        </div>

        {/* Right panel */}
        <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
            <p className="mt-1 text-sm text-gray-500">
              Already have one?{' '}
              <Link to="/login" className="text-emerald-600 hover:underline font-medium">Sign in</Link>
            </p>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {password && (
                  <p className={`mt-1 text-xs font-medium ${strength.color}`}>
                    Password strength: {strength.label}
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
              <a href="#" className="underline">Terms</a> and{' '}
              <a href="#" className="underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
