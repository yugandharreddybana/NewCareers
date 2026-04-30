import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Input }      from '@/components/ui';
import { Button }     from '@/components/ui';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // TODO: wire to auth service reset endpoint
      await new Promise(r => setTimeout(r, 900));
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we’ll send a reset link"
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-text-secondary hover:text-brand-500 transition-colors font-medium">
          <ArrowLeft size={13} /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center text-center py-4 gap-4">
          <div className="w-14 h-14 rounded-full bg-success-50 border border-success-100 flex items-center justify-center">
            <CheckCircle2 size={26} className="text-success-500" />
          </div>
          <div>
            <p className="font-semibold text-text-primary text-base">Check your inbox</p>
            <p className="text-sm text-text-secondary mt-1">
              We sent a reset link to <strong>{email}</strong>.
              Check your spam folder if you don’t see it.
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => { setSent(false); setEmail(''); }}
          >
            Send another link
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-danger-50 border border-danger-100 text-danger-600 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            leftIcon={<Mail size={15} />}
          />

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
