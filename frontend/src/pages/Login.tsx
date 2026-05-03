import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Zap, ArrowRight, Loader2 } from 'lucide-react';

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_GUARDS === 'true' || import.meta.env.DEV || import.meta.env.MODE === 'development';

// ── Left panel social proof data ──────────────────────────────────────────
const STATS = [
  { value: '2,400+', label: 'Irish jobs tracked' },
  { value: '14', label: 'AI career skills' },
  { value: '500+', label: 'Job seekers onboarded' },
];

import { useEffect } from 'react';

export default function Login() {
  const { signIn, user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user) {
      nav(user.onboarded ? '/dashboard' : '/onboarding', { replace: true });
    }
  }, [user, nav]);

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (DEV_BYPASS) {
      nav('/dashboard', { replace: true });
      return;
    }
    setLoading(true);
    try {
      const u = await signIn(form.email, form.password);
      nav(u.onboarded ? '/dashboard' : '/onboarding', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col bg-slate-900 px-12 py-14 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/10 pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-emerald-500/5 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-auto">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
            <Zap size={17} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-lg text-white">Career<span className="text-emerald-400">Ops</span></span>
        </div>

        {/* Tagline */}
        <div className="my-auto space-y-4">
          <h1 className="text-4xl font-black text-white leading-tight">
            Land your next role<br />
            <span className="text-emerald-400">faster, smarter.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            AI-powered job matching for the Irish market. Your personalised pipeline, daily.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            {STATS.map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-2xl font-black text-emerald-400">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer quote */}
        <p className="text-xs text-slate-600 mt-auto">
          &copy; {new Date().getFullYear()} CareerOps — Built for Ireland
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Zap size={15} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-slate-900">Career<span className="text-emerald-500">Ops</span></span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-8">Sign in to your CareerOps account</p>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                required
                className="w-full px-4 h-12 rounded-xl border border-slate-200 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 transition-all bg-white"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  required
                  className="w-full px-4 pr-11 h-12 rounded-xl border border-slate-200 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : (
                <><span>Sign in</span><ArrowRight size={16} /></>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Google (UI only) */}
            <button
              type="button"
              className="w-full h-12 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don’t have an account?{' '}
            <Link to="/signup" className="font-semibold text-emerald-600 hover:text-emerald-700">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
