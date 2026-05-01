/**
 * Analytics API service.
 * Calls the Node middleware which proxies to Java backend.
 *
 * Batch 4 — added getTimeSeries() wired to GET /api/analytics/time-series
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

/** One data point for the weekly trend chart */
export interface TimeSeriesPoint {
  /** ISO date string for Monday of that week, e.g. "2026-04-28" */
  week:         string;
  applications: number;
  matchAvg:     number;
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

  /**
   * GET /api/analytics/time-series?weeks=N
   * Returns one data point per week for the last N weeks.
   * Each point: { week: "2026-04-28", applications: 3, matchAvg: 72 }
   *
   * @param weeks number of rolling weeks to fetch (1-52, default 8)
   */
  getTimeSeries: async (weeks = 8): Promise<TimeSeriesPoint[]> => {
    const res = await api.get<TimeSeriesPoint[]>(`/api/analytics/time-series?weeks=${weeks}`);
    return res.data;
  },
};
