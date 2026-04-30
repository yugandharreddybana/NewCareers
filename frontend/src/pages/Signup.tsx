import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Input }      from '@/components/ui';
import { Button }     from '@/components/ui';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

export default function Signup() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
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
    <AuthLayout
      title="Create your account"
      subtitle="Start finding your next role in Ireland"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-500 hover:text-brand-600 transition-colors">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-danger-50 border border-danger-100 text-danger-600 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          value={form.name}
          onChange={set('name')}
          required
          leftIcon={<User size={15} />}
        />

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set('email')}
          required
          leftIcon={<Mail size={15} />}
        />

        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={set('password')}
          required
          leftIcon={<Lock size={15} />}
          hint="Use 8+ characters with a mix of letters and numbers"
          rightIcon={
            <button type="button" onClick={() => setShowPw(v => !v)} className="focus-ring rounded">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          }
        />

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-1">
          Create free account
        </Button>

        <p className="text-center text-[11px] text-text-tertiary leading-relaxed">
          By creating an account you agree to our{' '}
          <a href="#" className="underline hover:text-text-secondary">Terms</a>
          {' & '}
          <a href="#" className="underline hover:text-text-secondary">Privacy Policy</a>
        </p>
      </form>
    </AuthLayout>
  );
}
