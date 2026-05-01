import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Gift, Copy, Check, Send, Users, UserCheck, Star, Mail } from 'lucide-react';
import {
  createReferral,
  getMyReferrals,
  type ReferralDto,
  type ReferralStats,
} from '@/services/referralsApi';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 border border-amber-200'       },
  signed_up: { label: 'Signed Up', cls: 'bg-blue-50 text-blue-700 border border-blue-200'           },
  rewarded:  { label: 'Rewarded',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

export default function Refer() {
  const { user } = useAuth();

  const [referrals, setReferrals] = useState<ReferralDto[]>([]);
  const [stats,     setStats]     = useState<ReferralStats>({ sent: 0, signedUp: 0, rewarded: 0 });
  const [loading,   setLoading]   = useState(true);

  const [email,      setEmail]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sendError,  setSendError]  = useState('');

  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/signup?ref=${user?.id ?? ''}`;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyReferrals();
      setReferrals(data.referrals);
      setStats(data.stats);
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setSendStatus('idle');
    setSendError('');
    try {
      await createReferral(email.trim());
      setSendStatus('success');
      setEmail('');
      await load();
    } catch (err: unknown) {
      setSendStatus('error');
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSendError(msg || 'Failed to send invite. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Gift size={22} className="text-brand-500" />
          Refer &amp; Earn
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Invite friends to CareerOps. When they sign up using your link, you both get rewarded.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Invites Sent', value: stats.sent,      icon: <Mail      size={16} />, colour: 'text-brand-500'   },
          { label: 'Signed Up',   value: stats.signedUp,  icon: <UserCheck size={16} />, colour: 'text-blue-500'    },
          { label: 'Rewarded',    value: stats.rewarded,  icon: <Star      size={16} />, colour: 'text-emerald-500' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border rounded-xl p-4 flex flex-col gap-1">
            <span className={cn('w-7 h-7 rounded-lg bg-surface-raised flex items-center justify-center shrink-0', s.colour)}>
              {s.icon}
            </span>
            <p className="text-2xl font-bold text-text-primary mt-1">{s.value}</p>
            <p className="text-xs text-text-tertiary">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Shareable Link */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Your Shareable Link</h2>
        <p className="text-xs text-text-secondary">
          Share this anywhere — anyone who signs up via this link earns you a reward.
        </p>
        <div className="flex items-center gap-2 bg-surface-raised rounded-lg px-3 py-2.5 border border-border">
          <span className="flex-1 text-xs text-text-secondary font-mono truncate select-all">
            {referralLink}
          </span>
          <button
            onClick={copyLink}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            {copied
              ? <><Check size={13} className="text-emerald-500" /> Copied!</>
              : <><Copy  size={13} /> Copy</>
            }
          </button>
        </div>
      </div>

      {/* Email Invite */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Send Email Invite</h2>
        <p className="text-xs text-text-secondary">
          Send a personalised invite directly to a friend&rsquo;s inbox.
        </p>
        <form onSubmit={handleSendInvite} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setSendStatus('idle'); }}
            placeholder="friend@example.com"
            required
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-text-primary placeholder:text-text-tertiary"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={13} />
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
        {sendStatus === 'success' && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <Check size={12} /> Invite sent successfully!
          </p>
        )}
        {sendStatus === 'error' && (
          <p className="text-xs text-danger-600">{sendError}</p>
        )}
      </div>

      {/* Referral History Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users size={15} className="text-text-tertiary" />
          <h2 className="text-sm font-semibold text-text-primary">Referral History</h2>
          <span className="ml-auto text-xs text-text-tertiary">{referrals.length} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-sm text-text-tertiary">
            Loading…
          </div>
        ) : referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-center px-4">
            <Gift size={30} className="text-text-tertiary opacity-30" />
            <p className="text-sm text-text-secondary">No referrals yet</p>
            <p className="text-xs text-text-tertiary">
              Share your link or send an email invite above to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Email</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Date Sent</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrals.map(r => {
                  const s = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                  return (
                    <tr key={r.id} className="hover:bg-surface-overlay transition-colors">
                      <td className="px-5 py-3 text-text-primary truncate max-w-[200px]">{r.refereeEmail}</td>
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', s.cls)}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {new Date(r.createdAt).toLocaleDateString('en-IE', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3">
                        {r.status === 'rewarded'
                          ? <span className="text-emerald-600 font-semibold text-xs">✓ Earned</span>
                          : <span className="text-text-tertiary text-xs">Pending</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
