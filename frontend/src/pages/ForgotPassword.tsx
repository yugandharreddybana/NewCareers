import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthLayout from '@/components/ui/AuthLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email'); return; }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Reset your password'}
      subtitle={sent ? undefined : 'We\'ll send you a reset link'}
    >
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 text-center"
          >
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-success-50 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-success-600" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-text-secondary">
                We sent a password reset link to
              </p>
              <p className="text-sm font-semibold text-text-primary">{email}</p>
              <p className="text-xs text-text-muted mt-2">
                Check your spam folder if you don't see it within a few minutes.
              </p>
            </div>
            <Button variant="secondary" size="lg" className="w-full" onClick={() => setSent(false)}>
              Try a different email
            </Button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4"
          >
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              error={error}
              leftIcon={<Mail size={15} />}
              autoComplete="email"
              autoFocus
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Send reset link
            </Button>
            <Link
              to="/login"
              className="flex items-center justify-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
