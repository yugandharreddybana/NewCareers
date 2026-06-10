import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/authCtx';

import { billingApi, type SubscriptionStatusCode } from '@/services/billingApi';

import { SUBSCRIPTION_QUERY_KEY } from '@/lib/subscriptionUtils';



const STALE_TIME_MS = 5 * 60_000;



export { SUBSCRIPTION_QUERY_KEY };



function normalizeStatus(status: string | undefined): SubscriptionStatusCode | null {

  if (!status) return null;

  const upper = status.toUpperCase();

  if (upper === 'CANCELED') return 'CANCELLED';

  if (upper === 'TRIALING') return 'ACTIVE';

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



  const subscription = user ? (query.data ?? null) : null;

  const status = normalizeStatus(subscription?.status);



  return {

    subscription,

    plan: subscription?.plan ?? null,

    effectivePlan: subscription?.effectivePlan ?? subscription?.plan ?? null,

    status,

    usageThisMonth: subscription?.usageThisMonth ?? null,

    isLoading: query.isLoading,

    isError: query.isError,

    error: query.error,

    refetch: query.refetch,

  };

}

