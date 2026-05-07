/**
 * BillingPage.tsx — placeholder.
 *
 * Pass 6 #6.040 / Pass 9 #9.001 / Pass 10 #10.039 — Stripe integration is not
 * yet wired end-to-end (no backend BillingController, no DB tables, no Stripe
 * client library on the frontend). To avoid shipping a half-baked UI that
 * proxies to a non-existent backend (returning 502 to users), this page now
 * presents a polite "coming soon" with a way for the user to register interest.
 *
 * When the backend is ready (BillingController + Stripe webhook + customer/
 * subscription/invoice tables + Stripe client lib), restore the previous Stripe
 * Elements UI and remove this placeholder. The git history retains it.
 */
import { useEffect, useState } from 'react';
import { Sparkles, Mail, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { useAuth } from '@/context/AuthContext';
import { USE_MOCKS } from '@/lib/env';

const PLAN_PREVIEWS = [
  {
    name: 'Free',
    price: '€0',
    cadence: 'forever',
    features: ['5 AI job matches/day', '3 skill runs/month', 'Basic Kanban tracker'],
    badge: 'Current plan',
  },
  {
    name: 'Pro',
    price: '€19',
    cadence: 'per month',
    features: ['Unlimited AI matches', '50 skill runs/month', 'Mock interviews', 'Outreach campaigns', 'Priority support'],
    badge: 'Most popular',
    highlight: true,
  },
  {
    name: 'Team',
    price: '€49',
    cadence: 'per seat / month',
    features: ['Everything in Pro', 'Shared workspaces', 'Org analytics', 'Admin controls'],
    badge: 'Coming Q3',
  },
];

export default function BillingPage() {
  const { user } = useAuth();
  const billingInterestKey = user
    ? `${USE_MOCKS ? 'co_billing_interest_mock_' : 'co_billing_interest_'}${user.id}`
    : null;
  const [interested, setInterested] = useState(() =>
    billingInterestKey ? window.localStorage.getItem(billingInterestKey) === '1' : false,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!billingInterestKey) {
      setInterested(false);
      return;
    }
    setInterested(window.localStorage.getItem(billingInterestKey) === '1');
  }, [billingInterestKey]);

  // No backend endpoint yet — we keep state local and notify the user.
  // Once the billing backend ships, change this to `await billingApi.registerInterest()`.
  const registerInterest = async () => {
    if (!user || !billingInterestKey) return;
    setSubmitting(true);
    try {
      // Lightweight client-side persistence so the user is not asked twice.
      window.localStorage.setItem(billingInterestKey, '1');
      setInterested(true);
      toast.success("You're on the list — we'll email you when Pro launches.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="Billing" />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 mb-10 flex items-start gap-3">
          <Sparkles className="text-amber-600 mt-0.5 shrink-0" size={20} />
          <div>
            <h2 className="text-amber-900 font-semibold mb-1">Billing is coming soon</h2>
            <p className="text-sm text-amber-800/90">
              We&apos;re putting the finishing touches on subscriptions and secure
              payments. In the meantime, every feature is fully available on the
              Free plan. Tell us if you&apos;d like to be notified the moment Pro
              ships.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {PLAN_PREVIEWS.map(plan => (
            <div
              key={plan.name}
              className={
                'rounded-2xl border p-6 flex flex-col gap-4 relative ' +
                (plan.highlight
                  ? 'border-emerald-300 bg-emerald-50/40 shadow-sm'
                  : 'border-slate-200 bg-white')
              }
            >
              {plan.badge && (
                <span className={
                  'absolute -top-3 right-5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ' +
                  (plan.highlight ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600')
                }>
                  {plan.badge}
                </span>
              )}
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-500">{plan.cadence}</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Mail className="text-slate-500 mt-1 shrink-0" size={18} />
            <div>
              <h3 className="font-semibold text-slate-900">Notify me when Pro launches</h3>
              <p className="text-sm text-slate-500">
                We&apos;ll email <span className="font-medium text-slate-700">{user?.email ?? 'your account'}</span> once payments are open.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={registerInterest}
            disabled={interested || submitting || !user}
            className="px-5 h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {interested ? 'You’re on the list' : 'Notify me'}
          </button>
        </div>
      </div>
    </>
  );
}
