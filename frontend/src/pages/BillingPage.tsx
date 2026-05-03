import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import {
  CreditCard, Zap, CheckCircle, AlertTriangle,
  ExternalLink, RefreshCw, Download, ChevronRight,
  Star, Shield, Sparkles,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  badge?: string;
  highlight?: boolean;
}

interface BillingStatus {
  planId: string | null;
  planName: string | null;
  status: 'active' | 'trialing' | 'cancelled' | 'past_due' | 'none';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  jobsUsed: number;
  jobsLimit: number;
  skillsUsed: number;
  skillsLimit: number;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void';
  pdfUrl?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────────────
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'EUR',
    interval: 'month',
    features: ['5 AI job matches/day', '3 skill runs/month', 'Basic Kanban tracker', 'Community support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    currency: 'EUR',
    interval: 'month',
    badge: 'Most Popular',
    highlight: true,
    features: ['25 AI job matches/day', 'Unlimited skill runs', 'Full Kanban + Analytics', 'CV Manager + AI tailoring', 'Priority email support', 'Watchlists & Auto-Apply'],
  },
  {
    id: 'teams',
    name: 'Teams',
    price: 49,
    currency: 'EUR',
    interval: 'month',
    badge: 'Best Value',
    features: ['Everything in Pro', 'Up to 5 team members', 'Shared workspaces', 'Advanced analytics', 'Dedicated success manager'],
  },
];

const MOCK_STATUS: BillingStatus = {
  planId: 'pro',
  planName: 'Pro',
  status: 'active',
  currentPeriodEnd: new Date(Date.now() + 86400000 * 22).toISOString(),
  cancelAtPeriodEnd: false,
  jobsUsed: 18,
  jobsLimit: 25,
  skillsUsed: 42,
  skillsLimit: -1, // unlimited
};

const MOCK_INVOICES: Invoice[] = [
  { id: 'inv-1', date: new Date(Date.now() - 86400000 * 30).toISOString(), amount: 19, currency: 'EUR', status: 'paid' },
  { id: 'inv-2', date: new Date(Date.now() - 86400000 * 60).toISOString(), amount: 19, currency: 'EUR', status: 'paid' },
  { id: 'inv-3', date: new Date(Date.now() - 86400000 * 90).toISOString(), amount: 19, currency: 'EUR', status: 'paid' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────────
function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusColor(s: BillingStatus['status']) {
  return {
    active: 'bg-emerald-100 text-emerald-700',
    trialing: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-600',
    past_due: 'bg-amber-100 text-amber-700',
    none: 'bg-gray-100 text-gray-500',
  }[s];
}

// ── Plan card ────────────────────────────────────────────────────────────────────
const PlanCard: React.FC<{
  plan: Plan;
  isCurrent: boolean;
  onUpgrade: (planId: string) => void;
  upgrading: boolean;
}> = ({ plan, isCurrent, onUpgrade, upgrading }) => (
  <div className={`relative flex flex-col rounded-2xl border p-6 transition-shadow ${
    plan.highlight
      ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-lg shadow-indigo-100'
      : 'border-gray-200 hover:shadow-sm'
  } bg-white`}>
    {plan.badge && (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 text-white text-[10px] font-bold rounded-full">
        {plan.badge}
      </span>
    )}
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        {plan.id === 'free' && <Shield size={15} className="text-gray-400" />}
        {plan.id === 'pro'   && <Zap size={15} className="text-indigo-500" />}
        {plan.id === 'teams' && <Sparkles size={15} className="text-purple-500" />}
        <span className="text-sm font-bold text-gray-900">{plan.name}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-gray-900">
          {plan.price === 0 ? 'Free' : fmt(plan.price, plan.currency)}
        </span>
        {plan.price > 0 && <span className="text-xs text-gray-400">/{plan.interval}</span>}
      </div>
    </div>
    <ul className="space-y-2 flex-1 mb-5">
      {plan.features.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
          <CheckCircle size={13} className="text-emerald-500 shrink-0 mt-0.5" />
          {f}
        </li>
      ))}
    </ul>
    {isCurrent ? (
      <div className="py-2 text-center text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-xl">
        ✓ Current Plan
      </div>
    ) : (
      <button
        onClick={() => onUpgrade(plan.id)}
        disabled={upgrading}
        className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          plan.highlight
            ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
        } disabled:opacity-50`}
      >
        {upgrading ? 'Redirecting…' : plan.price === 0 ? 'Downgrade' : 'Upgrade'}
      </button>
    )}
  </div>
);

// ── Usage bar ────────────────────────────────────────────────────────────────────
const UsageBar: React.FC<{ label: string; used: number; limit: number }> = ({ label, used, limit }) => {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 30 : Math.min((used / limit) * 100, 100);
  const warn = !isUnlimited && pct >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className={`font-bold ${warn ? 'text-amber-600' : 'text-gray-700'}`}>
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${warn ? 'bg-amber-400' : 'bg-indigo-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isUnlimited && <p className="text-[10px] text-gray-400">Unlimited on your plan</p>}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const BillingPage: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus]   = useState<BillingStatus | null>(null);
  const [plans, setPlans]     = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) {
          await new Promise(r => setTimeout(r, 600));
          setStatus(MOCK_STATUS); setPlans(MOCK_PLANS); setInvoices(MOCK_INVOICES);
        } else {
          const [s, p, inv] = await Promise.all([
            api.get('/billing').then(r => r.data).catch(() => MOCK_STATUS),
            api.get('/billing/plans').then(r => r.data).catch(() => ({ plans: MOCK_PLANS })),
            api.get('/billing/invoices').then(r => r.data).catch(() => ({ invoices: [] })),
          ]);
          setStatus(s as BillingStatus);
          setPlans((p as { plans: Plan[] }).plans ?? MOCK_PLANS);
          setInvoices((inv as { invoices: Invoice[] }).invoices ?? []);
        }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(true);
    try {
      if (USE_MOCKS) { toast.success('Mock: redirecting to Stripe checkout…'); return; }
      const { url } = await api.post<{ url: string }>('/billing/checkout', { planId }).then(r => r.data);
      window.location.href = url;
    } catch { toast.error('Failed to start checkout.'); }
    finally { setUpgrading(false); }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      if (USE_MOCKS) { toast.success('Mock: opening customer portal…'); return; }
      const { url } = await api.post<{ url: string }>('/billing/portal').then(r => r.data);
      window.open(url, '_blank');
    } catch { toast.error('Failed to open billing portal.'); }
    finally { setPortalLoading(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription at the end of the billing period?')) return;
    setCancelling(true);
    try {
      if (USE_MOCKS) { setStatus(s => s ? { ...s, cancelAtPeriodEnd: true } : s); toast.success('Subscription will cancel at period end.'); return; }
      await api.post('/billing/cancel');
      setStatus(s => s ? { ...s, cancelAtPeriodEnd: true } : s);
      toast.success('Subscription will cancel at period end.');
    } catch { toast.error('Failed to cancel subscription.'); }
    finally { setCancelling(false); }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      if (USE_MOCKS) { setStatus(s => s ? { ...s, cancelAtPeriodEnd: false } : s); toast.success('Subscription reactivated!'); return; }
      await api.post('/billing/reactivate');
      setStatus(s => s ? { ...s, cancelAtPeriodEnd: false } : s);
      toast.success('Subscription reactivated!');
    } catch { toast.error('Failed to reactivate.'); }
    finally { setReactivating(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading billing…</div>
  );

  return (
    <>
      <PageMeta title="Billing — CareerOps" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Billing & Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your subscription, usage and invoices.</p>
        </div>

        {/* Current plan status */}
        {status && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Plan</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-gray-900">{status.planName ?? 'Free'}</p>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${statusColor(status.status)}`}>
                    {status.status}
                  </span>
                </div>
                {status.cancelAtPeriodEnd && status.currentPeriodEnd && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Cancels {fmtDate(status.currentPeriodEnd)}
                  </p>
                )}
                {!status.cancelAtPeriodEnd && status.currentPeriodEnd && (
                  <p className="text-xs text-gray-400 mt-1">Renews {fmtDate(status.currentPeriodEnd)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {status.cancelAtPeriodEnd ? (
                  <button
                    onClick={handleReactivate}
                    disabled={reactivating}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={reactivating ? 'animate-spin' : ''} />
                    {reactivating ? 'Reactivating…' : 'Reactivate'}
                  </button>
                ) : status.planId && status.planId !== 'free' ? (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-3 py-2 border border-red-200 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel Plan'}
                  </button>
                ) : null}
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <ExternalLink size={13} />
                  {portalLoading ? 'Opening…' : 'Manage Billing'}
                </button>
              </div>
            </div>

            {/* Usage bars */}
            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UsageBar label="AI Job Matches (today)" used={status.jobsUsed} limit={status.jobsLimit} />
              <UsageBar label="Skill Runs (this month)" used={status.skillsUsed} limit={status.skillsLimit} />
            </div>
          </div>
        )}

        {/* Plan picker */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={status?.planId === plan.id}
                onUpgrade={handleUpgrade}
                upgrading={upgrading}
              />
            ))}
          </div>
        </div>

        {/* Invoice list */}
        {invoices.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Invoice History</h2>
            <div className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fmtDate(inv.date)}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{inv.status.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">{fmt(inv.amount, inv.currency)}</span>
                    {inv.pdfUrl && (
                      <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-500 transition-colors">
                        <Download size={15} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center">
          Payments processed securely by <strong>Stripe</strong>. Your card details are never stored on our servers.
          Questions? Email <a href="mailto:billing@careerops.ie" className="text-indigo-500 hover:underline">billing@careerops.ie</a>
        </p>

      </div>
    </>
  );
};

export default BillingPage;
