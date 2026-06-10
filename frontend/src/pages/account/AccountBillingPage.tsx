import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useSubscription } from '@/hooks/useSubscription';
import {
  billingApi,
  type BillingInvoice,
  type SubscriptionPlanCode,
  type SubscriptionResponse,
} from '@/services/billingApi';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { assignStripeHostedUrl } from '@/lib/stripeRedirect';
import { AccountSettingsPageHeader } from './AccountSettingsPageHeader';

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

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function statusLabel(status: SubscriptionResponse['status']): string {
  return status.replace(/_/g, ' ');
}

function isUnlimitedLimit(limit: number): boolean {
  return limit < 0;
}

function usagePercent(used: number, limit: number): number {
  if (isUnlimitedLimit(limit) || limit <= 0) return Math.min((used / 100) * 15, 100);
  return Math.min((used / limit) * 100, 100);
}

function planDisplayName(plan: SubscriptionPlanCode): string {
  switch (plan) {
    case 'PRO':
      return 'Pro';
    case 'ENTERPRISE':
      return 'Elite';
    default:
      return 'Free';
  }
}

function cancelFeatureLoss(plan: SubscriptionPlanCode): string[] {
  switch (plan) {
    case 'ENTERPRISE':
      return ['Unlimited AI Skill Runs', 'Unlimited CV profiles', 'Priority support'];
    case 'PRO':
      return ['200 AI Skill Runs per month', '10 CV profiles', 'Interview Prep Suite'];
    default:
      return ['Premium features'];
  }
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
  const unlimited = isUnlimitedLimit(limit);
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

  const {
    subscription,
    isLoading: subscriptionLoading,
    isError: subscriptionError,
    refetch: refetchSubscription,
  } = useSubscription();

  const plansQuery = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => billingApi.getPlans(),
    staleTime: 300_000,
    retry: false,
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => billingApi.getInvoices(),
    staleTime: 60_000,
    retry: false,
    enabled: Boolean(subscription?.canManageBilling && subscription?.hasBillingAccount),
  });

  const invoices: BillingInvoice[] = invoicesQuery.isError ? [] : (invoicesQuery.data ?? []);

  const openPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const { url } = await billingApi.openPortal();
      assignStripeHostedUrl(url);
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err, 'Could not open billing portal.'));
      setPortalLoading(false);
    }
  }, []);

  const startCheckout = useCallback(async (plan: SubscriptionPlanCode) => {
    setCheckoutLoading(true);
    try {
      const { url } = await billingApi.createCheckoutSession(plan);
      assignStripeHostedUrl(url);
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
      await refetchSubscription();
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err, 'Could not cancel subscription. Try the billing portal.'));
    } finally {
      setCancelLoading(false);
    }
  }, [refetchSubscription]);

  const storedPlan = subscription?.plan ?? 'FREE';
  const displayPlan = subscription?.effectivePlan ?? storedPlan;
  const status = subscription?.status ?? 'ACTIVE';
  const canManageBilling = Boolean(subscription?.canManageBilling);
  const hasBillingAccount = Boolean(subscription?.hasBillingAccount);
  const cancelAtPeriodEnd = Boolean(subscription?.cancelAtPeriodEnd);
  const aiUsed = subscription?.usageThisMonth.aiRuns ?? 0;
  const aiLimit = subscription?.limits.aiRunsPerMonth ?? 5;
  const appsUsed = subscription?.usageThisMonth.applications ?? 0;
  const appsLimit = subscription?.limits.applicationsPerMonth ?? 10;
  const cvUsed = subscription?.cvUploadsTotal ?? 0;
  const cvLimit = subscription?.limits.cvUploads ?? 1;

  return (
    <main className="flex-1 flex flex-col gap-stack-lg min-w-0">
      <AccountSettingsPageHeader
        title="Subscription & Billing"
        subtitle="Manage your plan, billing cycle, and payment methods."
      />

      {status === 'PAST_DUE' && !subscriptionError && (
        <div className="bg-amber-50 border border-amber-200 rounded p-stack-md flex flex-col sm:flex-row sm:items-center gap-stack-md">
          <p className="font-body-md text-body-md text-amber-950 flex-1">
            Your last payment failed. Update your payment method in the customer portal to keep your{' '}
            {planDisplayName(displayPlan)} plan active.
          </p>
          {canManageBilling && hasBillingAccount && (
            <button
              type="button"
              disabled={portalLoading}
              onClick={() => void openPortal()}
              className="font-label-md text-label-md bg-amber-900 text-white px-4 py-2 rounded shrink-0 disabled:opacity-50"
            >
              {portalLoading ? 'Opening…' : 'Update payment method'}
            </button>
          )}
        </div>
      )}

      {cancelAtPeriodEnd && canManageBilling && hasBillingAccount && !subscriptionError && (
        <div className="bg-surface-container border border-outline-variant rounded p-stack-md flex flex-col sm:flex-row sm:items-center gap-stack-md">
          <p className="font-body-md text-body-md text-on-surface-variant flex-1">
            Your subscription is set to cancel on {formatDate(subscription?.currentPeriodEnd)}. You can
            resume billing in the Stripe customer portal before that date.
          </p>
          <button
            type="button"
            disabled={portalLoading}
            onClick={() => void openPortal()}
            className="font-label-md text-label-md border border-outline hover:bg-surface-container-high text-on-surface px-4 py-2 rounded shrink-0 disabled:opacity-50"
          >
            {portalLoading ? 'Opening…' : 'Manage in portal'}
          </button>
        </div>
      )}

      {subscriptionError && (
        <div className="bg-error-container border border-error/30 rounded p-stack-md flex flex-col sm:flex-row sm:items-center gap-stack-md">
          <p className="font-body-md text-body-md text-on-error-container flex-1">
            Could not load your subscription. Billing actions are unavailable until this is resolved.
          </p>
          <button
            type="button"
            className="font-label-md text-label-md text-on-error-container underline shrink-0"
            onClick={() => void refetchSubscription()}
          >
            Retry
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
              <span className="font-display text-display text-on-surface">
                {displayPlan}
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">/ month</span>
            </div>
            {subscriptionLoading ? (
              <p className="font-body-md text-body-md text-on-surface-variant">Loading plan details…</p>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
                {cancelAtPeriodEnd
                    ? `Your plan stays active until ${formatDate(subscription?.currentPeriodEnd)}, then moves to Free.`
                  : displayPlan === 'FREE'
                    ? 'You are on the free plan. Upgrade to unlock Pro features.'
                    : `Your plan renews on ${formatDate(subscription?.currentPeriodEnd)}.`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-stack-md">
            {displayPlan === 'FREE' && canManageBilling && !subscriptionLoading && (
              <>
                {(plansQuery.data ?? [])
                  .filter(plan => plan.name === 'PRO' || plan.name === 'ENTERPRISE')
                  .map(plan => (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={checkoutLoading}
                      onClick={() => void startCheckout(plan.name as SubscriptionPlanCode)}
                      className="font-label-md text-label-md bg-primary text-on-primary px-5 py-2.5 rounded transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
                    >
                      {checkoutLoading
                        ? 'Redirecting…'
                        : `Upgrade to ${planDisplayName(plan.name as SubscriptionPlanCode)}`}
                    </button>
                  ))}
              </>
            )}
            {canManageBilling && hasBillingAccount && (
              <button
                type="button"
                disabled={portalLoading}
                onClick={() => void openPortal()}
                className="font-label-md text-label-md bg-primary text-on-primary px-5 py-2.5 rounded transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
              >
                {portalLoading ? 'Opening…' : 'Manage Subscription'}
              </button>
            )}
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
          {subscriptionLoading ? (
            <p className="font-body-sm text-on-surface-variant">Loading usage…</p>
          ) : (
            <>
              <p className="font-label-sm text-label-sm text-on-surface-variant -mt-1 mb-1">
                AI skill runs reset each billing period (30 days from checkout). Auto-apply runs reset each calendar month.
              </p>
              <UsageBar label="AI Skill Runs" used={aiUsed} limit={aiLimit} />
              <UsageBar label="Auto-Apply Runs" used={appsUsed} limit={appsLimit} />
              <UsageBar label="CV Versions" used={cvUsed} limit={cvLimit} />
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
                {hasBillingAccount ? 'Managed via Stripe' : 'No card on file'}
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Update payment details in the customer portal
              </p>
            </div>
          </div>
          {canManageBilling && hasBillingAccount && (
            <button
              type="button"
              disabled={portalLoading}
              onClick={() => void openPortal()}
              className="w-full font-label-md text-label-md border border-outline hover:bg-surface-container text-on-surface px-4 py-2 rounded transition-all duration-200 disabled:opacity-50"
            >
              Update Payment Method
            </button>
          )}
        </section>

        <section className="glass-panel rounded p-gutter lg:col-span-2 overflow-x-auto">
          <h3 className="account-settings-card-label mb-stack-md">Billing History</h3>
          {!canManageBilling ? (
            <p className="font-body-md text-on-surface-variant">
              Billing history is available to organization owners and admins.
            </p>
          ) : invoicesQuery.isLoading ? (
            <p className="font-body-sm text-on-surface-variant">Loading invoices…</p>
          ) : invoicesQuery.isError ? (
            <p className="font-body-md text-on-surface-variant">
              Could not load billing history. Try again later.
            </p>
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

      {displayPlan !== 'FREE' && canManageBilling && hasBillingAccount && !cancelAtPeriodEnd && !subscriptionError && (
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
              If you cancel your {displayPlan} plan, you will lose access to:
            </p>
            <ul className="flex flex-col gap-2 mb-stack-lg font-body-md text-body-md text-on-surface-variant">
              {cancelFeatureLoss(displayPlan as SubscriptionPlanCode).map(feature => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-error">close</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-stack-md">
              <button
                type="button"
                className="font-label-md text-label-md border border-outline hover:bg-surface-container text-on-surface px-4 py-2 rounded transition-all"
                onClick={() => setCancelModalOpen(false)}
              >
                Keep {displayPlan} Plan
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
