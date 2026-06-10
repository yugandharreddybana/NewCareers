import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { safeRedirectPath } from '@/components/ProtectedRoute';
import {
  formatPlanLimitFeature,
} from '@/lib/subscriptionUtils';
import {
  subscribePlanLimitExceeded,
  type PlanLimitPayload,
} from '@/lib/planLimitEvents';

function planDisplayName(plan: string): string {
  switch (plan.toUpperCase()) {
    case 'PRO':
      return 'Pro';
    case 'ENTERPRISE':
      return 'Elite';
    default:
      return 'Free';
  }
}

function upgradeCtaLabel(currentPlan: string): string {
  switch (currentPlan.toUpperCase()) {
    case 'FREE':
      return 'Upgrade to Pro';
    case 'PRO':
      return 'Upgrade to Elite';
    default:
      return 'View plans';
  }
}

export function PlanLimitBanner() {
  const [payload, setPayload] = useState<PlanLimitPayload | null>(null);

  useEffect(() => subscribePlanLimitExceeded(setPayload), []);

  if (!payload) return null;

  const featureLabel = formatPlanLimitFeature(payload.feature);
  const planLabel = planDisplayName(payload.currentPlan);
  const upgradeLabel = upgradeCtaLabel(payload.currentPlan);
  const upgradePath = safeRedirectPath(payload.upgradeUrl) ?? '/pricing';

  return (
    <div
      className="w-full bg-amber-50 border-b border-amber-200 text-amber-950 shadow-sm"
      role="alert"
    >
      <div className="app-shell py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
        <p className="font-body-md text-body-md flex-1">
          You&apos;ve reached your {featureLabel} limit on the {planLabel} plan.{' '}
          <Link
            to={upgradePath}
            className="font-label-md text-label-md text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {upgradeLabel}
          </Link>{' '}
          to continue.
        </p>
        <button
          type="button"
          className="font-label-md text-label-md text-amber-800 hover:text-amber-950 self-end sm:self-auto px-2 py-1 rounded hover:bg-amber-100 transition-colors"
          onClick={() => setPayload(null)}
          aria-label="Dismiss plan limit notice"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
