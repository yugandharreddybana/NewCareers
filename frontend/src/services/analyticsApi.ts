/**
 * Section 5 — Task 49
 * Analytics API service.
 * Calls the Node middleware which proxies to Java backend.
 */

import { api } from './api';

// ── Response types ───────────────────────────────────────────────────────────

export interface SkillUsageItem {
  skill: string;
  count: number;
}

export interface AnalyticsSummary {
  skillsRunThisWeek:     number;
  applicationsSubmitted: number;
  avgMatchPercent:       number;
  skillUsage:            SkillUsageItem[];
}

export interface FunnelStage {
  stage: string;
  count: number;
}

// ── API calls ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  /**
   * GET /api/analytics/summary
   * Returns weekly stats: skills run, applications submitted, avg match %,
   * and per-skill usage counts for the skill usage chart.
   */
  getSummary: async (): Promise<AnalyticsSummary> => {
    const res = await api.get<AnalyticsSummary>('/api/analytics/summary');
    return res.data;
  },

  /**
   * GET /api/analytics/funnel
   * Returns ordered funnel stages:
   * Discovered → Saved → Applied → Interview → Offer → Rejected
   */
  getFunnel: async (): Promise<FunnelStage[]> => {
    const res = await api.get<FunnelStage[]>('/api/analytics/funnel');
    return res.data;
  },
};
