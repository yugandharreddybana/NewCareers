import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { BRAND_NAME, SALES_EMAIL } from '@/lib/brand';
import { subscriptionPlanToCardId } from '@/lib/subscriptionUtils';
import { billingApi, type SubscriptionPlanCode } from '@/services/billingApi';

interface PlanFeature {
  text: string;
  iconColor?: 'primary' | 'secondary' | 'tertiary';
  textVariant?: 'default' | 'muted';
}

interface PricingPlan {
  id: string;
  checkoutPlan?: SubscriptionPlanCode;
  name: string;
  monthlyPrice: number;
  description: string;
  features: PlanFeature[];
  cta: string;
  ctaVariant: 'outline' | 'primary' | 'tertiary';
  highlighted?: boolean;
  badge?: string;
}

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    description: 'Start your solo job search with the essentials.',
    features: [
      { text: '5 AI runs per month' },
      { text: '10 active job applications' },
      { text: '1 CV profile' },
    ],
    cta: 'Get Started Free',
    ctaVariant: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    checkoutPlan: 'PRO',
    monthlyPrice: 49,
    description: 'Full toolkit for one person running a serious job search.',
    features: [
      { text: '200 AI runs per month', textVariant: 'default' },
      { text: 'Unlimited job tracking', textVariant: 'default' },
      { text: '10 CV profiles', textVariant: 'default' },
      { text: 'Interview Prep Suite', iconColor: 'secondary', textVariant: 'default' },
      { text: 'Personal Networking CRM', iconColor: 'secondary', textVariant: 'default' },
      { text: 'Transition Analytics', iconColor: 'secondary', textVariant: 'default' },
    ],
    cta: 'Upgrade to Pro',
    ctaVariant: 'primary',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'elite',
    name: 'Elite',
    checkoutPlan: 'ENTERPRISE',
    monthlyPrice: 79,
    description: 'Unlimited power for one individual at peak search intensity.',
    features: [
      { text: 'Unlimited AI runs', iconColor: 'tertiary' },
      { text: 'Unlimited job tracking', iconColor: 'tertiary' },
      { text: 'Unlimited CV profiles', iconColor: 'tertiary' },
      { text: 'Work Permit Intel', iconColor: 'tertiary' },
      { text: 'Priority support', iconColor: 'tertiary' },
    ],
    cta: 'Upgrade to Elite',
    ctaVariant: 'primary',
  },
];

function displayPrice(monthlyPrice: number): number {
  return monthlyPrice;
}

function checkIconColor(color: PlanFeature['iconColor']): string {
  switch (color) {
    case 'secondary':
      return 'text-secondary';
    case 'tertiary':
      return 'text-tertiary';
    default:
      return 'text-primary';
  }
}

export default function BillingPage() {
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const {
    subscription,
    isTrialing,
    daysRemaining,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
  } = useSubscription();
  const navigate = useNavigate();

  const currentPlanId = subscription ? subscriptionPlanToCardId(subscription.plan) : null;

  const handlePaidUpgrade = async (plan: PricingPlan) => {
    if (!plan.checkoutPlan) return;
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/billing' } } });
      return;
    }
    setCheckoutLoading(plan.id);
    try {
      const { url } = await billingApi.createCheckoutSession(plan.checkoutPlan);
      window.location.href = url;
    } catch {
      toast.error('Checkout unavailable right now. Try again later or contact support.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const resolveCtaLabel = (plan: PricingPlan, isCurrent: boolean): string => {
    if (checkoutLoading === plan.id) return 'Redirecting…';
    if (isCurrent) return 'Current Plan';
    if (plan.id === 'free') return plan.cta;
    return 'Upgrade Now';
  };

  const handlePlanCta = (plan: PricingPlan) => {
    if (plan.id === 'free') {
      navigate('/get-started');
      return;
    }
    if (plan.checkoutPlan) {
      void handlePaidUpgrade(plan);
    }
  };

  return (
    <>
      <PageMeta title={`${BRAND_NAME} | Pricing`} />
      <div className="font-sans antialiased min-h-screen flex flex-col text-on-surface bg-surface">
        <MarketingNav activeLink="pricing" />

        <main className="flex-grow pt-32 pb-stack-xl px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full flex flex-col items-center">
          <div className="text-center mb-stack-xl max-w-2xl">
            <h1 className="font-display text-display text-on-surface mb-stack-md">
              Invest in your career operating system.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Simple pricing for individual job seekers. Pick the plan that fits your search — one account,
              one career, upgrade anytime.
            </p>
          </div>

          {user && subscriptionError && (
            <div className="w-full mb-stack-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <p className="font-body-md text-body-md text-amber-950">
                Could not load your subscription. You can still browse plans below.
              </p>
              <button
                type="button"
                className="font-label-sm text-label-sm text-amber-900 underline shrink-0"
                onClick={() => void refetchSubscription()}
              >
                Retry
              </button>
            </div>
          )}

          {user && isTrialing && !subscriptionError && (
            <div className="w-full mb-stack-lg rounded-lg border border-primary/20 bg-primary/5 px-6 py-4 text-center">
              <p className="font-label-md text-label-md text-primary">
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left in your trial
              </p>
            </div>
          )}

          <div className="flex items-center gap-stack-md mb-stack-xl bg-surface-container p-1 rounded-full border border-outline-variant/30 shadow-sm">
            <button
              type="button"
              className="font-label-md text-label-md px-6 py-2 rounded-full bg-surface text-on-surface shadow-sm transition-all"
              aria-pressed
            >
              Monthly
            </button>
            <button
              type="button"
              disabled
              title="Annual billing is coming soon — all plans are billed monthly today"
              className="font-label-md text-label-md px-6 py-2 rounded-full flex items-center gap-2 text-on-surface-variant opacity-60 cursor-not-allowed"
              aria-pressed={false}
            >
              Yearly{' '}
              <span className="bg-surface-container-high text-on-surface-variant text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Coming soon
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter w-full mb-stack-xl">
            {PLANS.map((plan) => {
              const price = displayPrice(plan.monthlyPrice);
              const featureTextClass =
                plan.highlighted ? 'text-on-surface' : 'text-on-surface-variant';
              const isCurrentPlan =
                !subscriptionLoading && user && currentPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`glass-panel rounded p-gutter flex flex-col h-full shadow-sm hover:shadow-md transition-shadow ${
                    plan.highlighted
                      ? 'border-primary relative transform md:-translate-y-4 shadow-lg bg-white border'
                      : 'border border-outline-variant/40 hover:border-primary/30 transition-colors'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-on-primary font-label-sm text-label-sm px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                      {plan.badge}
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute top-4 right-4 bg-surface-container text-on-surface font-label-sm text-label-sm px-2 py-1 rounded border border-outline-variant/50">
                      Current Plan
                    </div>
                  )}
                  <div className="mb-stack-md">
                    <h3
                      className={`font-headline-md text-headline-md mb-stack-sm ${
                        plan.highlighted ? 'text-primary' : 'text-on-surface'
                      }`}
                    >
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-display text-on-surface">€{price}</span>
                      <span className="font-body-md text-body-md text-on-surface-variant">/mo</span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-stack-sm">
                      {plan.description}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-stack-sm mb-stack-lg flex-grow">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.text}
                        className={`flex items-center gap-2 font-body-md text-body-md ${
                          feature.textVariant === 'default' ? featureTextClass : 'text-on-surface-variant'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] ${checkIconColor(feature.iconColor)}`}
                        >
                          check
                        </span>
                        {feature.text}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={
                      isCurrentPlan ||
                      (!!plan.checkoutPlan && checkoutLoading === plan.id)
                    }
                    className={`w-full py-3 rounded font-label-md text-label-md mt-auto transition-all shadow-sm ${
                      isCurrentPlan
                        ? 'border border-outline-variant/50 text-on-surface-variant bg-surface-container cursor-default'
                        : plan.ctaVariant === 'primary'
                          ? 'bg-primary text-on-primary btn-glow shadow-md'
                          : 'border border-outline-variant text-on-surface hover:bg-surface-variant'
                    }`}
                    onClick={() => !isCurrentPlan && handlePlanCta(plan)}
                  >
                    {resolveCtaLabel(plan, !!isCurrentPlan)}
                  </button>
                </div>
              );
            })}
          </div>
        </main>

        <footer className="w-full py-stack-xl px-margin-mobile md:px-margin-desktop grid grid-cols-2 md:grid-cols-4 gap-gutter max-w-container-max mx-auto bg-background border-t border-outline-variant/30">
          <div className="col-span-2 md:col-span-1 flex flex-col gap-stack-sm">
            <div className="font-headline-md text-headline-md font-bold text-on-surface">{BRAND_NAME}</div>
            <p className="font-body-md text-body-md text-on-surface-variant text-sm mt-2">
              © {new Date().getFullYear()} {BRAND_NAME} AI. All rights reserved.
            </p>
          </div>
          <div className="flex flex-col gap-stack-sm">
            <Link
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200 hover:underline"
              to="/#features"
            >
              Product
            </Link>
            <Link
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200 hover:underline"
              to="/#features"
            >
              Company
            </Link>
          </div>
          <div className="flex flex-col gap-stack-sm">
            <Link
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200 hover:underline"
              to="/privacy"
            >
              Legal
            </Link>
            <a
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200 hover:underline"
              href={`mailto:${SALES_EMAIL}`}
            >
              Connect
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
