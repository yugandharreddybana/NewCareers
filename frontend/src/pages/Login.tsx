/**
 * Login.tsx — sign-in page.
 *
 * Pass 6 fixes folded in:
 *   #6.002          — switches to the canonical `/signup` route.
 *   #6.003          — DEV_BYPASS only honoured when `VITE_DEV_BYPASS_GUARDS=true`;
 *                    no more silent dev-mode bypass.
 *   #6.015          — dead "Continue with Google" button removed (OAuth not
 *                    implemented). Re-add after backend SSO ships.
 *   #6.016          — social-proof stats now come from `/public/stats`.
 *   #6.017          — surfaces `err.normalizedMessage` from the axios interceptor.
 *   #6.018          — single redirect via a `redirected` ref; no flicker on
 *                    rapid auth-state changes.
 *   #6.037          — `lib/env.ts` is the single source of truth for env flags.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageMeta } from '@/components/PageMeta';
import { publicApi } from '@/services/api';
import { DEV_BYPASS, USE_MOCKS } from '@/lib/env';
import { isApiError } from '@/types';

interface Stat {
  value: string;
  label: string;
}

const FALLBACK_STATS: Stat[] = [
  { value: '14',  label: 'AI career skills' },
  { value: 'EU',  label: 'Built for the Irish market' },
  { value: '24/7', label: 'Daily fresh job feed' },
];

const formatCount = (n: number): string => {
  if (n >= 1000) return `${Math.floor(n / 100) / 10}k+`;
  if (n > 0)     return `${n}+`;
  return '—';
};

export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pass 6 #6.018 — redirect-once gate: prevents double-navigate races.
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    if (!user) return;
    redirected.current = true;
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    const target = from ?? (user.onboarded ? '/dashboard' : '/onboarding');
    navigate(target, { replace: true });
  }, [user, navigate, location.state]);

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (DEV_BYPASS || USE_MOCKS) {
      // The bypass calls signIn anyway (which short-circuits to MOCK_USER) so
      // the UI behaves identically to a real sign-in.
    }
    setSubmitting(true);
    try {
      await signIn(form.email, form.password);
      // Effect above handles navigation on user state change.
    } catch (err: unknown) {
      // Pass 6 #6.017 — prefer the normalised message from the axios interceptor.
      if (isApiError(err)) {
        setError(err.normalizedMessage || 'Invalid email or password.');
      } else if (err instanceof Error) {
        setError(err.message || 'Invalid email or password.');
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Real social-proof stats from backend ───────────────────────────────
  const [stats, setStats] = useState<Stat[]>(FALLBACK_STATS);
  useEffect(() => {
    let cancelled = false;
    publicApi.stats()
      .then(s => {
        if (cancelled) return;
        const next: Stat[] = [
          { value: formatCount(s.jobs),  label: 'Live jobs tracked' },
          { value: String(s.skills),    label: 'AI career skills' },
          { value: formatCount(s.users), label: 'Job seekers onboarded' },
        ];
        setStats(next);
      })
      .catch(() => { /* silently keep fallback — no toast on home page */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex">
      <PageMeta title="Sign In" />

      {/* ── Left brand panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col bg-slate-900 px-12 py-14 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/10 pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-emerald-500/5 pointer-events-none" />

        <div className="flex items-center gap-2.5 mb-auto">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
            <Zap size={17} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-lg text-white">
            Career<span className="text-emerald-400">Ops</span>
          </span>
        </div>

        <div className="my-auto space-y-4">
          <h1 className="text-4xl font-black text-white leading-tight">
            Land your next role<br />
            <span className="text-emerald-400">faster, smarter.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            AI-powered job matching for the Irish market. Your personalised pipeline, daily.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            {stats.map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-2xl font-black text-emerald-400">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600 mt-auto">
          &copy; {new Date().getFullYear()} CareerOps — Built for Ireland
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-[400px]">

          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Zap size={15} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-slate-900">
              Career<span className="text-emerald-500">Ops</span>
            </span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-8">Sign in to your CareerOps account</p>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                required
                className="w-full px-4 h-12 rounded-xl border border-slate-200 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 transition-all bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
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
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? <Loader2 size={17} className="animate-spin" /> : (
                <><span>Sign in</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-emerald-600 hover:text-emerald-700">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
