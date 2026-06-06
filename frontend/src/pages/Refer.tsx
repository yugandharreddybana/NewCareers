import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { referralsApi, type ReferralDto, type ReferralStats } from '@/services/referralsApi';
import toast from 'react-hot-toast';
import { Gift, Copy, Check, Mail, Users, Award, CheckCircle, Clock } from 'lucide-react';

const STATUS_META = {
  pending:   { label: 'Pending',   color: 'bg-gray-100 text-gray-500',   icon: <Clock size={11} /> },
  signed_up: { label: 'Signed Up', color: 'bg-blue-100 text-blue-700',   icon: <CheckCircle size={11} /> },
  rewarded:  { label: 'Rewarded',  color: 'bg-emerald-100 text-emerald-700', icon: <Award size={11} /> },
};

const ReferPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats]         = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralDto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [email, setEmail]         = useState('');
  const [sending, setSending]     = useState(false);
  const [copied, setCopied]       = useState(false);

  const referralCode = user?.id ?? '';

  useEffect(() => {
    const load = async () => {
      try {
        const { referrals: refs, stats: s } = await referralsApi.getMyReferrals();
        setStats(s);
        setReferrals(refs);
      } catch {
        toast.error('Failed to load referrals.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleCopy = () => {
    if (!referralCode) {
      toast.error('Sign in to get your referral link.');
      return;
    }
    const link = `${window.location.origin}/signup?ref=${referralCode}`;
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); toast.success('Link copied!'); });
  };

  const handleInvite = async () => {
    if (!email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { toast.error('Enter a valid email address.'); return; }
    setSending(true);
    try {
      const ref = await referralsApi.createReferral(email);
      setReferrals(prev => [ref, ...prev]);
      setStats(s => s ? { ...s, sent: s.sent + 1 } : s);
      setEmail('');
      toast.success(`Invite sent to ${email}!`);
    } catch { toast.error('Failed to send invite.'); }
    finally { setSending(false); }
  };

  if (loading) return <PageLoader />;

  const referralLink = referralCode
    ? `${window.location.origin}/signup?ref=${referralCode}`
    : '';

  return (
    <>
      <PageMeta title="Refer a Friend — NewCareers" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white text-center">
          <Gift size={32} className="mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold">Refer a Friend</h1>
          <p className="text-sm opacity-80 mt-2">Invite friends to NewCareers and earn <strong>1 free month of Pro</strong> for every friend who signs up and stays 7 days.</p>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Invites Sent',  value: stats.sent,     icon: <Mail size={15} /> },
              { label: 'Signed Up',     value: stats.signedUp, icon: <Users size={15} /> },
              { label: 'Rewards Earned', value: stats.rewarded, icon: <Award size={15} /> },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{s.icon}</div>
                <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-[10px] text-gray-400">{s.label}</p></div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Your Referral Link</h2>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-600 font-mono truncate">
              {referralLink || 'Sign in to generate your referral link.'}
            </div>
            <button onClick={handleCopy} disabled={!referralCode}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${ copied ? 'bg-emerald-500 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`}>
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
          <div className="flex gap-2">
            <a href={referralLink ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I'm using NewCareers to supercharge my job search with AI — join me! ${referralLink}`)}` : '#'}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 text-center hover:bg-gray-50 transition-colors">Share on X</a>
            <a href={referralLink ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}` : '#'}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 text-center hover:bg-gray-50 transition-colors">Share on LinkedIn</a>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Invite by Email</h2>
          <div className="flex gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="friend@example.com" onKeyDown={e => e.key === 'Enter' && void handleInvite()}
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button onClick={() => void handleInvite()} disabled={sending}
              className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              {sending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </div>

        {referrals.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Referrals</h2>
            <div className="divide-y divide-gray-100">
              {referrals.map(r => {
                const meta = STATUS_META[r.status];
                return (
                  <div key={r.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.refereeEmail}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-indigo-800 mb-3">🎉 How it works</h3>
          <ol className="space-y-2">
            {['Share your unique referral link or invite by email', 'Friend signs up and uses NewCareers for 7+ days', 'You get 1 free month of Pro automatically — no code needed'].map((s, i) => (
              <li key={i} className="text-xs text-indigo-700 flex items-start gap-2"><span className="font-bold mt-0.5">{i + 1}.</span>{s}</li>
            ))}
          </ol>
        </div>

      </div>
    </>
  );
};

export default ReferPage;
