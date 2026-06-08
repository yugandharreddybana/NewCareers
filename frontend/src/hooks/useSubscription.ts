import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { billingApi, type SubscriptionStatusCode } from '@/services/billingApi';
import { computeTrialDaysRemaining } from '@/lib/subscriptionUtils';

const STALE_TIME_MS = 5 * 60_000;

/** Shared React Query key — use everywhere subscription data is fetched (BILL-048). */
export const SUBSCRIPTION_QUERY_KEY = ['subscription'] as const;

function normalizeStatus(status: string | undefined): SubscriptionStatusCode | null {
  if (!status) return null;
  const upper = status.toUpperCase();
  if (upper === 'CANCELED') return 'CANCELLED';
  return upper as SubscriptionStatusCode;
}

export function useSubscription() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: billingApi.getSubscription,
    staleTime: STALE_TIME_MS,
    enabled: !!user,
  });

  const trialEndsAt = query.data?.trialEndsAt ?? null;
  const daysRemaining =
    query.data?.daysRemaining ?? computeTrialDaysRemaining(trialEndsAt);
  const status = normalizeStatus(query.data?.status);
  const isTrialing = status === 'TRIALING' && daysRemaining > 0;

  return {
    subscription: query.data ?? null,
    plan: query.data?.plan ?? null,
    status,
    trialEndsAt,
    daysRemaining,
    usageThisMonth: query.data?.usageThisMonth ?? null,
    isTrialing,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
