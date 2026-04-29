import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '@/components/ui/AuthLayout';
import { authApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await authApi.login({ email, password });
      setUser(user);
      nav(user.onboarded ? '/dashboard' : '/onboarding', { replace: true });
    } catch (err: any) {
      toast.error(err.normalizedMessage || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue" footer={<>Don&apos;t have an account? <Link className="text-ink-900 underline" to="/signup">Sign up</Link></>}>
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="text-sm text-slate-600">Email</label>
          <input className="input mt-1" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-600">Password</label>
          <div className="relative mt-1">
            <input className="input pr-16" type={show ? 'text' : 'password'} required value={password} onChange={e => setPwd(e.target.value)} />
            <button type="button" className="absolute right-2 top-1.5 text-xs text-slate-500" onClick={() => setShow(s => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-slate-500 hover:text-ink-900">Forgot password?</Link>
        </div>
        <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Logging in…' : 'Login'}</button>
      </form>
    </AuthLayout>
  );
}
