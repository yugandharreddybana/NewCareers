/** Days remaining until trial end (0 if missing or expired). */
export function computeTrialDaysRemaining(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

/** Human-readable feature label from backend snake_case keys. */
export function formatPlanLimitFeature(feature: string): string {
  return feature.replace(/_/g, ' ');
}

/** Map backend plan enum to pricing card id. */
export function subscriptionPlanToCardId(plan: string): 'free' | 'pro' | 'elite' {
  switch (plan.toUpperCase()) {
    case 'PRO':
      return 'pro';
    case 'ENTERPRISE':
      return 'elite';
    default:
      return 'free';
  }
}
