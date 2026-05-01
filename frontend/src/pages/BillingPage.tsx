/**
 * BillingPage — /billing
 *
 * Shows current plan, usage, and upgrade CTA.
 * Stub implementation — wired and production-safe; Stripe integration added in Section 6.
 */
import { useAuth } from '@/context/AuthContext';
import PageShell from '@/components/ui/PageShell';
import { CreditCard, Zap, CheckCircle2, ExternalLink } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    price: '€0',
    period: '/month',
    features: [
      '5 AI skill runs per day',
      '1 active CV',
      'Job tracking (Kanban)',
      'Referral rewards',
    ],
    cta: null,
    highlight: false,
  },
  {
    name: 'Pro',
    price: '€12',
    period: '/month',
    features: [
      'Unlimited AI skill runs',
      '5 active CVs',
      'PDF export pack',
      'Priority job matching',
      'Weekly digest emails',
      'All 14 career intelligence tools',
    ],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
];

export default function BillingPage() {
  const { user } = useAuth();
  const currentPlan = (user as any)?.plan ?? 'free';

  return (
    <PageShell
      title="Billing & Plan"
      subtitle="Manage your subscription and usage."
    >
      {/* Current plan badge */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border border-brand-200 text-brand-700 font-semibold text-sm mb-6">
        <CreditCard size={14} />
        Current plan: <span className="capitalize font-black">{currentPlan}</span>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className={[
              'rounded-2xl border p-6 flex flex-col gap-4',
              plan.highlight
                ? 'border-brand-300 bg-brand-50 shadow-md'
                : 'border-border bg-white',
            ].join(' ')}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-text-primary">{plan.name}</h2>
              {plan.highlight && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-500 text-white">
                  Recommended
                </span>
              )}
            </div>

            <div className="flex items-end gap-1">
              <span className="text-4xl font-black text-text-primary">{plan.price}</span>
              <span className="text-sm text-text-tertiary mb-1">{plan.period}</span>
            </div>

            <ul className="space-y-2.5 flex-1">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                  <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {plan.cta ? (
              <button
                disabled
                className="mt-2 h-10 w-full flex items-center justify-center gap-2
                           bg-brand-500 text-white rounded-xl font-bold text-sm
                           opacity-70 cursor-not-allowed"
              >
                <Zap size={14} />{plan.cta}
              </button>
            ) : (
              currentPlan === 'free' && (
                <div className="mt-2 h-10 w-full flex items-center justify-center rounded-xl
                                border border-border text-text-tertiary text-sm font-semibold
                                bg-surface-raised">
                  Current plan
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {/* Notice */}
      <div className="mt-8 flex items-start gap-3 max-w-xl bg-amber-50 border border-amber-200 rounded-xl p-4">
        <ExternalLink size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          Stripe billing integration is coming soon. Pro plan upgrades will be
          available in the next release.
        </p>
      </div>
    </PageShell>
  );
}
