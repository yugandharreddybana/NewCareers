import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '@/components/ui/AuthLayout';
import { authApi } from '@/services/api';

export default function ForgotPassword() {
  const [step, setStep] = useState<1|2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  async function request(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgot(email);
      toast.success('If that email exists, a code has been sent');
      setStep(2);
    } catch (err: any) { toast.error(err.normalizedMessage || 'Failed'); }
    finally { setLoading(false); }
  }
  async function reset(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.reset({ email, otp, newPassword: pw });
      toast.success('Password reset. Please log in.');
      setStep(1);
    } catch (err: any) { toast.error(err.normalizedMessage || 'Failed'); }
    finally { setLoading(false); }
  }

  return (
    <AuthLayout title={step === 1 ? 'Forgot password' : 'Enter the code'}
                subtitle={step === 1 ? 'We will email you a 6-digit code' : 'Code expires in 15 minutes'}
                footer={<><Link className="text-ink-900 underline" to="/login">Back to login</Link></>}>
      {step === 1 ? (
        <form className="space-y-3" onSubmit={request}>
          <div><label className="text-sm">Email</label>
            <input className="input mt-1" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Sending…' : 'Send code'}</button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={reset}>
          <div><label className="text-sm">6-digit code</label>
            <input className="input mt-1" required pattern="\d{6}" value={otp} onChange={e=>setOtp(e.target.value)} /></div>
          <div><label className="text-sm">New password</label>
            <input className="input mt-1" type="password" required minLength={8} value={pw} onChange={e=>setPw(e.target.value)} /></div>
          <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Resetting…' : 'Reset password'}</button>
        </form>
      )}
    </AuthLayout>
  );
}
