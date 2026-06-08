import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { billingApi } from '@/services/billingApi';
import { computeTrialDaysRemaining } from '@/lib/subscriptionUtils';

const STALE_TIME_MS = 5 * 60_000;

export function useSubscription() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['subscription'],
    queryFn: billingApi.getSubscription,
    staleTime: STALE_TIME_MS,
    enabled: !!user,
  });

  const trialEndsAt = query.data?.trialEndsAt ?? null;
  const daysRemaining =
    query.data?.daysRemaining ?? computeTrialDaysRemaining(trialEndsAt);
  const isTrialing =
    query.data?.status?.toUpperCase() === 'TRIALING' && daysRemaining > 0;

  return {
    subscription: query.data ?? null,
    plan: query.data?.plan ?? null,
    status: query.data?.status ?? null,
    trialEndsAt,
    daysRemaining,
    usageThisMonth: query.data?.usageThisMonth ?? null,
    isTrialing,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
