/**
 * billingApi.ts — typed service layer for /api/billing
 *
 * All calls proxy through Node middleware → Java backend → Stripe.
 */
import { api } from './api';

export type SubscriptionPlanCode = 'FREE' | 'PRO' | 'ENTERPRISE';

/** Backend uses British spelling only; normalize any legacy US spelling at the hook layer. */
export type SubscriptionStatusCode =
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED';

export interface PlanLimitsResponse {
  aiRunsPerMonth: number;
  applicationsPerMonth: number;
  cvUploads: number;
  teamMembers: number;
}

export interface SubscriptionResponse {
  organizationId: string;
  plan: SubscriptionPlanCode;
  effectivePlan: SubscriptionPlanCode;
  status: SubscriptionStatusCode;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;

  cancelAtPeriodEnd: boolean;
  daysRemaining: number;
  hasBillingAccount: boolean;
  canManageBilling: boolean;
  usageThisMonth: {
    aiRuns: number;
    applications: number;
  };
  limits: PlanLimitsResponse;
  cvUploadsTotal: number;
}

export interface SessionUrlResponse {
  url: string;
}

export interface CancelSubscriptionResponse {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export interface BillingPlanCatalogItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export interface BillingInvoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  pdfUrl: string | null;
}

export interface BillingUsageMetrics {
  skillsUsed: number;
  skillsLimit: number;
  jobsScanned: number;
  jobsLimit: number;
  resetDate: string;
}

export const billingApi = {
  getSubscription: () =>
    api.get<SubscriptionResponse>('/billing/subscription').then(r => r.data),

  createCheckoutSession: (plan: SubscriptionPlanCode) =>
    api.post<SessionUrlResponse>('/billing/checkout-session', { plan }).then(r => r.data),

  getPlans: () =>
    api.get<BillingPlanCatalogItem[]>('/billing/plans').then(r => r.data),

  openPortal: () =>
    api.post<SessionUrlResponse>('/billing/customer-portal', {}).then(r => r.data),

  getInvoices: () =>
    api.get<BillingInvoice[]>('/billing/invoices').then(r => r.data),

  getUsage: () =>
    api.get<BillingUsageMetrics>('/billing/usage').then(r => r.data),

  cancel: () =>
    api.post<CancelSubscriptionResponse>('/billing/cancel').then(r => r.data),
};

