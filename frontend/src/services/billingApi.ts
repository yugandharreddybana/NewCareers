/**
 * billingApi.ts — typed service layer for /api/billing
 *
 * All calls proxy through Node middleware → Java backend → Stripe.
 */
import { api } from './api';

export type SubscriptionPlanCode = 'FREE' | 'PRO' | 'ENTERPRISE';

export type SubscriptionStatusCode =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'CANCELED';

export interface SubscriptionResponse {
  plan: SubscriptionPlanCode;
  status: SubscriptionStatusCode;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number;
  usageThisMonth: {
    aiRuns: number;
    applications: number;
  };
}

export interface SessionUrlResponse {
  url: string;
}

/** @deprecated Legacy shape — prefer SubscriptionResponse */
export interface Subscription {
  status: 'active' | 'trialing' | 'cancelled' | 'past_due' | 'none';
  planId: string | null;
  planName: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  pdfUrl: string | null;
}

export interface UsageMetrics {
  skillsUsed: number;
  skillsLimit: number;
  jobsScanned: number;
  jobsLimit: number;
  resetDate: string;
}

export const billingApi = {
  /** Current org subscription (plan, status, trial) */
  getSubscription: () =>
    api.get<SubscriptionResponse>('/billing/subscription').then(r => r.data),

  /** Create Stripe checkout session — returns { url } to redirect to */
  createCheckoutSession: (plan: SubscriptionPlanCode) =>
    api.post<SessionUrlResponse>('/billing/checkout-session', { plan }).then(r => r.data),

  /** List available plans */
  getPlans: () =>
    api.get<Plan[]>('/billing/plans').then(r => r.data),

  /** Open Stripe customer portal — returns { url } to redirect to */
  openPortal: () =>
    api.post<SessionUrlResponse>('/billing/customer-portal', {}).then(r => r.data),

  /** @deprecated Use createCheckoutSession */
  createCheckout: (planId: string) => {
    const plan = planId.toUpperCase() as SubscriptionPlanCode;
    return billingApi.createCheckoutSession(plan);
  },

  /** List past invoices */
  getInvoices: () =>
    api.get<Invoice[]>('/billing/invoices').then(r => r.data),

  /** Current period usage metrics */
  getUsage: () =>
    api.get<UsageMetrics>('/billing/usage').then(r => r.data),

  /** Cancel subscription at period end */
  cancel: () =>
    api.post('/billing/cancel').then(r => r.data),

  /** Reactivate a cancelled subscription */
  reactivate: () =>
    api.post('/billing/reactivate').then(r => r.data),
};
