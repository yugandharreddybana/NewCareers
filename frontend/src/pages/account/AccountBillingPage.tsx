import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  billingApi,
  type Invoice,
  type SubscriptionPlanCode,
  type SubscriptionResponse,
} from '@/services/billingApi';
import { useUsageLimits } from '@/hooks/queries/useUsageLimits';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { AccountSettingsPageHeader } from './AccountSettingsPageHeader';

const PLAN_PRICES: Record<SubscriptionPlanCode, number> = {
  FREE: 0,
  PRO: 29,
  ENTERPRISE: 99,
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function statusLabel(status: SubscriptionResponse['status']): string {
  return status.replace(/_/g, ' ');
}

function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  if (limit === Number.MAX_SAFE_INTEGER || limit > 1_000_000) return Math.min((used / 100) * 15, 100);
  return Math.min((used / limit) * 100, 100);
}

function UsageBar({
  label,
  used,
  limit,
  unlimitedLabel = '∞',
}: {
  label: string;
  used: number;
  limit: number;
  unlimitedLabel?: string;
}) {
  const unlimited = limit <= 0 || limit > 1_000_000;
  const displayLimit = unlimited ? unlimitedLabel : String(limit);
  const pct = unlimited ? usagePercent(used, 100) : usagePercent(used, limit);

  return (
    <div>
      <div className="flex justify-between font-label-sm text-label-sm mb-1">
        <span className="text-on-surface">{label}</span>
        <span className="text-on-surface-variant">
          {used} / {displayLimit}
        </span>
      </div>
      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AccountBillingPage() {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const subscriptionQuery = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => billingApi.getSubscription(),
    staleTime: 30_000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => billingApi.getInvoices(),
    staleTime: 60_000,
    retry: false,
  });

  const usageLimitsQuery = useUsageLimits();

  const subscription = subscriptionQuery.data;
  const invoices: Invoice[] = invoicesQuery.data ?? [];

  const openPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const { url } = await billingApi.openPortal();
      window.location.assign(url);
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err, 'Could not open billing portal.'));
      setPortalLoading(false);
    }
  }, []);

  const startCheckout = useCallback(async (plan: SubscriptionPlanCode) => {
    setCheckoutLoading(true);
    try {
      const { url } = await billingApi.createCheckoutSession(plan);
      window.location.assign(url);
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err, 'Could not start checkout.'));
      setCheckoutLoading(false);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    setCancelLoading(true);
    try {
      await billingApi.cancel();
      toast.success('Subscription will cancel at the end of your billing period.');
      setCancelModalOpen(false);
      await subscriptionQuery.refetch();
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err, 'Could not cancel subscription. Try the billing portal.'));
    } finally {
      setCancelLoading(false);
    }
  }, [subscriptionQuery]);

  const plan = subscription?.plan ?? 'FREE';
  const status = subscription?.status ?? 'ACTIVE';
  const isTrialing = status === 'TRIALING';
  const planPrice = PLAN_PRICES[plan] ?? 0;
  const chargeDate = subscription?.trialEndsAt ?? subscription?.currentPeriodEnd;

  const aiUsed = usageLimitsQuery.data
    ? Math.max(0, Number(usageLimitsQuery.data.aiTokens.limit) - Number(usageLimitsQuery.data.aiTokens.remaining))
    : 0;
  const aiLimit = Number(usageLimitsQuery.data?.aiTokens.limit ?? 200);

  const appsUsed = usageLimitsQuery.data
    ? Math.max(0, Number(usageLimitsQuery.data.jobDelivery.limit) - Number(usageLimitsQuery.data.jobDelivery.remaining))
    : 0;
  const appsLimit = Number(usageLimitsQuery.data?.jobDelivery.limit ?? 0);

  const showTrialBanner = isTrialing && subscription?.trialEndsAt;

  return (
    <main className="flex-1 flex flex-col gap-stack-lg min-w-0">
      <AccountSettingsPageHeader
        title="Subscription & Billing"
        subtitle="Manage your plan, billing cycle, and payment methods."
      />

      {showTrialBanner && (
        <div className="bg-secondary-container border border-secondary-container rounded p-stack-md flex items-start sm:items-center gap-stack-md">
          <span
            className="material-symbols-outlined text-on-secondary-container"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            info
          </span>
          <div className="flex-1">
            <p className="font-label-md text-label-md text-on-secondary-container">
              Your 14-day Pro trial ends on {formatDate(subscription.trialEndsAt)}
            </p>
          </div>
          <button
            type="button"
            disabled={checkoutLoading}
            onClick={() => void startCheckout('PRO')}
            className="font-label-sm text-label-sm bg-primary text-on-primary px-3 py-1.5 rounded font-semibold hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-50"
          >
            Upgrade Now
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <section className="glass-panel rounded p-gutter lg:col-span-2 flex flex-col justify-between gap-stack-lg">
          <div>
            <div className="flex items-center justify-between mb-stack-md">
              <h3 className="account-settings-card-label">Current Plan</h3>
              {subscription && (
                <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-label-sm text-label-sm flex items-center gap-1 border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {statusLabel(status)}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-stack-sm mb-stack-md">
              <span className="font-display text-display text-on-surface">{plan}</span>
              <span className="font-body-md text-body-md text-on-surface-variant">/ month</span>
            </div>
            {subscriptionQuery.isLoading ? (
              <p className="font-body-md text-body-md text-on-surface-variant">Loading plan details…</p>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
                {isTrialing
                  ? `You will be charged ${formatCurrency(planPrice)} on ${formatDate(chargeDate)}.`
                  : plan === 'FREE'
                    ? 'You are on the free plan. Upgrade to unlock Pro features.'
                    : `Your plan renews on ${formatDate(subscription?.currentPeriodEnd)}.`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-stack-md">
            <button
              type="button"
              disabled={portalLoading}
              onClick={() => void openPortal()}
              className="font-label-md text-label-md bg-primary text-on-primary px-5 py-2.5 rounded transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
            >
              {portalLoading ? 'Opening…' : 'Manage Subscription'}
            </button>
            {invoices[0]?.pdfUrl && (
              <a
                href={invoices[0].pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-label-md text-label-md border border-outline hover:bg-surface-container text-on-surface px-5 py-2.5 rounded transition-all duration-200 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Download Invoice
              </a>
            )}
          </div>
        </section>

        <section className="glass-panel rounded p-gutter flex flex-col gap-stack-md">
          <h3 className="account-settings-card-label mb-stack-sm">Current Usage</h3>
          {usageLimitsQuery.isLoading ? (
            <p className="font-body-sm text-on-surface-variant">Loading usage…</p>
          ) : (
            <>
              <UsageBar label="AI Skill Runs" used={aiUsed} limit={aiLimit} />
              <UsageBar label="Applications" used={appsUsed} limit={appsLimit || 1_000_000} />
              <UsageBar label="CV Versions" used={0} limit={plan === 'FREE' ? 1 : plan === 'PRO' ? 10 : 1_000_000} />
            </>
          )}
        </section>

        <section className="glass-panel rounded p-gutter lg:col-span-1">
          <h3 className="account-settings-card-label mb-stack-md">Payment Method</h3>
          <div className="flex items-center gap-stack-md mb-stack-lg p-stack-md bg-surface-container rounded border border-outline-variant">
            <div className="w-12 h-8 bg-surface-container-high rounded flex items-center justify-center border border-outline-variant">
              <span className="material-symbols-outlined text-on-surface-variant">credit_card</span>
            </div>
            <div className="flex-1">
              <p className="font-label-md text-label-md text-on-surface">
                {plan === 'FREE' ? 'No card on file' : 'Managed via Stripe'}
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Update payment details in the customer portal
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={portalLoading}
            onClick={() => void openPortal()}
            className="w-full font-label-md text-label-md border border-outline hover:bg-surface-container text-on-surface px-4 py-2 rounded transition-all duration-200 disabled:opacity-50"
          >
            Update Payment Method
          </button>
        </section>

        <section className="glass-panel rounded p-gutter lg:col-span-2 overflow-x-auto">
          <h3 className="account-settings-card-label mb-stack-md">Billing History</h3>
          {invoicesQuery.isLoading ? (
            <p className="font-body-sm text-on-surface-variant">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <p className="font-body-md text-on-surface-variant">No invoices yet.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm">
                  <th className="pb-stack-sm font-medium pr-4">Date</th>
                  <th className="pb-stack-sm font-medium pr-4">Description</th>
                  <th className="pb-stack-sm font-medium pr-4">Amount</th>
                  <th className="pb-stack-sm font-medium pr-4">Status</th>
                  <th className="pb-stack-sm font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md text-on-surface">
                {invoices.map(inv => (
                  <tr
                    key={inv.id}
                    className="border-b border-outline-variant hover:bg-surface-container transition-colors"
                  >
                    <td className="py-stack-sm pr-4">{formatDate(inv.date)}</td>
                    <td className="py-stack-sm pr-4">{inv.id}</td>
                    <td className="py-stack-sm pr-4">
                      {formatCurrency(inv.amount / 100, inv.currency.toUpperCase())}
                    </td>
                    <td className="py-stack-sm pr-4">
                      <span className="text-primary flex items-center gap-1 font-label-sm text-label-sm capitalize">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-stack-sm text-right">
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-on-surface-variant hover:text-on-surface transition-colors"
                          aria-label="Download invoice"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                        </a>
                      ) : (
                        <span className="text-on-surface-variant/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {plan !== 'FREE' && (
        <section className="border border-error/30 bg-error-container rounded p-gutter flex flex-col sm:flex-row items-start sm:items-center justify-between gap-stack-md">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-error-container mb-1">
              Cancel Subscription
            </h3>
            <p className="font-body-md text-body-md text-on-error-container">
              Cancel your subscription to downgrade to the free plan. You will lose access to Pro
              features at the end of your billing cycle.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCancelModalOpen(true)}
            className="shrink-0 font-label-md text-label-md bg-error text-on-error hover:bg-error/90 px-5 py-2.5 rounded transition-all duration-200"
          >
            Cancel Plan
          </button>
        </section>
      )}

      {cancelModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            onClick={() => setCancelModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative glass-panel rounded p-gutter max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-stack-md">
              <span className="material-symbols-outlined text-error">warning</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-stack-sm">Are you sure?</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-stack-md">
              If you cancel your Pro plan, you will lose access to:
            </p>
            <ul className="flex flex-col gap-2 mb-stack-lg font-body-md text-body-md text-on-surface-variant">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-error">close</span>
                Unlimited AI Skill Runs
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-error">close</span>
                Advanced Resume Parsing
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-error">close</span>
                Priority Support
              </li>
            </ul>
            <div className="flex justify-end gap-stack-md">
              <button
                type="button"
                className="font-label-md text-label-md border border-outline hover:bg-surface-container text-on-surface px-4 py-2 rounded transition-all"
                onClick={() => setCancelModalOpen(false)}
              >
                Keep Pro Plan
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={() => void handleCancel()}
                className="font-label-md text-label-md bg-error text-on-error px-4 py-2 rounded hover:bg-error/90 transition-all disabled:opacity-50"
              >
                {cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
