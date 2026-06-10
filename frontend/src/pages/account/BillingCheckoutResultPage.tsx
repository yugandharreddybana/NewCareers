import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { SUBSCRIPTION_QUERY_KEY } from '@/hooks/useSubscription';
import { billingApi } from '@/services/billingApi';

type Variant = 'success' | 'cancel';

const COPY: Record<Variant, { title: string; body: string; icon: string; tone: string }> = {
  success: {
    title: 'Subscription updated',
    body: 'Your payment was successful. Your plan is now active — you can manage billing anytime from account settings.',
    icon: 'check_circle',
    tone: 'text-primary',
  },
  cancel: {
    title: 'Checkout cancelled',
    body: 'No charges were made. You can return to billing settings to choose a plan when you are ready.',
    icon: 'cancel',
    tone: 'text-on-surface-variant',
  },
};

export default function BillingCheckoutResultPage({ variant }: { variant: Variant }) {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const copy = COPY[variant];
  const isMock = searchParams.has('mock_session');

  useEffect(() => {
    if (variant === 'success') {
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: queryKeys.usage.limits() });
      void (async () => {
        const delaysMs = [0, 1_500, 3_000, 6_000, 10_000];
        let initialPlan: string | null = null;
        for (const delayMs of delaysMs) {
          if (delayMs > 0) {
            await new Promise(resolve => window.setTimeout(resolve, delayMs));
          }
          const subscription = await queryClient.fetchQuery({
            queryKey: SUBSCRIPTION_QUERY_KEY,
            queryFn: billingApi.getSubscription,
            staleTime: 0,
          });
          if (initialPlan === null) {
            initialPlan = subscription.effectivePlan ?? subscription.plan;
          }
          const currentPlan = subscription.effectivePlan ?? subscription.plan;
          if (currentPlan !== 'FREE' && currentPlan !== initialPlan) break;
          if (subscription.status === 'ACTIVE' && currentPlan !== 'FREE') break;
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.usage.limits() });
      })().catch(() => undefined);
    }
  }, [variant, queryClient]);

  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-gutter py-stack-xl">
      <div className="glass-panel rounded p-gutter max-w-lg w-full text-center shadow-xl">
        <span
          className={`material-symbols-outlined text-5xl mb-stack-md ${copy.tone}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          {copy.icon}
        </span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-stack-sm">
          {copy.title}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
          {copy.body}
          {isMock && variant === 'success' ? ' (Development mock checkout.)' : null}
        </p>
        <Link
          to="/account/billing"
          className="inline-flex items-center justify-center font-label-md text-label-md bg-primary text-on-primary hover:bg-primary/90 px-6 py-2.5 rounded transition-colors"
        >
          Back to billing settings
        </Link>
      </div>
    </main>
  );
}
