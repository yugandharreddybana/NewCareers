import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '@/components/ui/AuthLayout';
import { authApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { user } = await authApi.signup({ name, username, email, password: pw });
      setUser(user);
      nav('/onboarding', { replace: true });
    } catch (err: any) {
      toast.error(err.normalizedMessage || 'Signup failed');
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout title="Create your account" footer={<>Already have an account? <Link className="text-ink-900 underline" to="/login">Login</Link></>}>
      <form className="space-y-3" onSubmit={submit}>
        <div><label className="text-sm text-slate-600">Full name</label>
          <input className="input mt-1" required value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="text-sm text-slate-600">Username</label>
          <input className="input mt-1" required minLength={3} maxLength={32} value={username} onChange={e => setUsername(e.target.value)} /></div>
        <div><label className="text-sm text-slate-600">Email</label>
          <input className="input mt-1" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="text-sm text-slate-600">Password</label>
          <input className="input mt-1" type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} /></div>
        <div><label className="text-sm text-slate-600">Confirm password</label>
          <input className="input mt-1" type="password" required value={pw2} onChange={e => setPw2(e.target.value)} /></div>
        <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
      </form>
    </AuthLayout>
  );
}
