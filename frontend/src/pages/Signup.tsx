import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthLayout from '@/components/ui/AuthLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Signup() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<{ name?: string; email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim())   e.name     = 'Full name is required';
    if (!email)         e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password)      e.password = 'Password is required';
    else if (password.length < 8)  e.password = 'Minimum 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp(email, password, name);
      nav('/onboarding');
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const strength =
    password.length === 0 ? 0 :
    password.length < 8   ? 1 :
    /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 3 : 2;

  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'];
  const strengthColour = ['', 'bg-danger-500', 'bg-warning-500', 'bg-success-500'];

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start landing more interviews with AI"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
          error={errors.name}
          leftIcon={<User size={15} />}
          autoComplete="name"
          autoFocus
        />
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
          error={errors.email}
          leftIcon={<Mail size={15} />}
          autoComplete="email"
        />
        <div>
          <Input
            label="Password"
            type={showPw ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
            error={errors.password}
            leftIcon={<Lock size={15} />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-text-muted hover:text-text-primary transition-colors"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
            autoComplete="new-password"
          />
          {/* Strength bar */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1,2,3].map((s) => (
                  <div
                    key={s}
                    className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                      s <= strength ? strengthColour[strength] : 'bg-surface-3'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-text-muted">
                Password strength: <span className="font-semibold">{strengthLabel[strength]}</span>
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Create account — it's free
        </Button>

        <p className="text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-brand font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
