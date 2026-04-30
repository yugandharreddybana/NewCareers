import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Zap, ArrowRight, Loader2, Check } from 'lucide-react';

const PERKS = [
  'Daily AI-matched jobs from 5+ sources',
  '14 career intelligence skills per job',
  'Kanban application tracker',
  'CV tailoring + ATS scoring',
];

export default function Signup() {
  const { signUp } = useAuth();
  const nav = useNavigate();

  const [form,    setForm]    = useState({ name: '', email: '', password: '' });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(form.name, form.email, form.password);
      nav('/onboarding');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col bg-slate-900 px-12 py-14 relative overflow-hidden">
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
        <div className="my-auto space-y-6">
          <h1 className="text-4xl font-black text-white leading-tight">
            Your AI-powered<br />
            <span className="text-emerald-400">career engine.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Everything you need to find, track, and land your next role in Ireland.
          </p>

          {/* Perks list */}
          <ul className="space-y-3 pt-2">
            {PERKS.map(perk => (
              <li key={perk} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-emerald-400" strokeWidth={3} />
                </div>
                <span className="text-slate-300 text-sm">{perk}</span>
              </li>
            ))}
          </ul>
        </div>

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

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Get started for free</h2>
          <p className="text-slate-400 text-sm mb-8">Join 500+ job seekers in Ireland</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full name</label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                value={form.name}
                onChange={set('name')}
                required
                className="w-full px-4 h-12 rounded-xl border border-slate-200 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 transition-all bg-white"
              />
            </div>

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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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
              {form.password.length > 0 && form.password.length < 8 && (
                <p className="text-xs text-red-500 mt-1.5">Must be at least 8 characters</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : (
                <><span>Create free account</span><ArrowRight size={16} /></>
              )}
            </button>

            <p className="text-center text-[11px] text-slate-400 leading-relaxed">
              By creating an account you agree to our{' '}
              <a href="#" className="underline hover:text-slate-600">Terms</a>
              {' & '}
              <a href="#" className="underline hover:text-slate-600">Privacy Policy</a>
            </p>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
