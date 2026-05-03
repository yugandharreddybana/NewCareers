/**
 * billingApi.ts — typed service layer for /api/billing
 *
 * All calls proxy through Node middleware → Java backend → Stripe.
 * Centralises billing API calls so pages don’t inline raw api.get/post calls.
 */
import { api } from './api';

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export interface Subscription {
  status: 'active' | 'trialing' | 'cancelled' | 'past_due' | 'none';
  planId: string | null;
  planName: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
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
  /** Current subscription status */
  getSubscription: () =>
    api.get<Subscription>('/billing').then(r => r.data),

  /** List available plans */
  getPlans: () =>
    api.get<Plan[]>('/billing/plans').then(r => r.data),

  /** Create Stripe checkout session — returns { url } to redirect to */
  createCheckout: (planId: string) =>
    api.post<{ url: string }>('/billing/checkout', { planId }).then(r => r.data),

  /** Open Stripe customer portal — returns { url } to redirect to */
  openPortal: () =>
    api.post<{ url: string }>('/billing/portal').then(r => r.data),

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
