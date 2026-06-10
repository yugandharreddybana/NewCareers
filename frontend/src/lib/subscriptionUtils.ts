/** Shared React Query key for subscription data (BILL-048). */
export const SUBSCRIPTION_QUERY_KEY = ['subscription'] as const;

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
