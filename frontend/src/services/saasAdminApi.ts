/**
 * saasAdminApi.ts — Admin SaaS operations dashboard API
 */
import { api } from './api';

export type SubscriptionPlanCode = 'FREE' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatusCode = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED';

export interface SaasMetrics {
  totalUsers: number;
  activeSubscriptions: number;
  mrr: number;
  churnRatePercent: number;
  trialConversionRatePercent: number;
  asOf: string;
}

export interface SubscriptionRow {
  orgId: string;
  orgName: string;
  plan: SubscriptionPlanCode;
  status: SubscriptionStatusCode;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

export interface PagedSubscriptions {
  rows: SubscriptionRow[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface FeatureFlagRow {
  id: string;
  flagKey: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string | null;
}

export interface AiUsageRow {
  orgId: string;
  orgName: string;
  totalTokens: number;
  totalCostUsd: number;
  requestCount: number;
}

export interface SubscriptionListParams {
  page?: number;
  size?: number;
  plan?: SubscriptionPlanCode;
  status?: SubscriptionStatusCode;
  search?: string;
}

export const saasAdminApi = {
  getMetrics: () =>
    api.get<SaasMetrics>('/admin/saas/metrics').then(r => r.data),

  listSubscriptions: (params: SubscriptionListParams = {}) =>
    api.get<PagedSubscriptions>('/admin/saas/subscriptions', { params }).then(r => r.data),

  overridePlan: (orgId: string, body: { plan: SubscriptionPlanCode; status?: SubscriptionStatusCode }) =>
    api.post<SubscriptionRow>(`/admin/saas/subscriptions/${orgId}/override-plan`, body).then(r => r.data),

  listFeatureFlags: () =>
    api.get<FeatureFlagRow[]>('/admin/saas/feature-flags').then(r => r.data),

  toggleFeatureFlag: (id: string) =>
    api.post<FeatureFlagRow>(`/admin/saas/feature-flags/${id}/toggle`).then(r => r.data),

  getAiUsage: () =>
    api.get<AiUsageRow[]>('/admin/saas/ai-usage').then(r => r.data),
};
