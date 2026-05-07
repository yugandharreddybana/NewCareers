/**
 * Analytics API service.
 * Calls the Node middleware which proxies to Java backend.
 *
 * Batch 4 — added getTimeSeries() wired to GET /api/analytics/time-series
 */

import { USE_MOCKS } from '@/lib/env';
import type { AnalyticsSummary, FunnelStage, TimeSeriesPoint } from '@/types/analytics';
export type { AnalyticsSummary, FunnelStage, SkillUsageItem, TimeSeriesPoint } from '@/types/analytics';
import { api } from './api';

const MOCK_SUMMARY: AnalyticsSummary = {
  skillsRunThisWeek: 4,
  applicationsSubmitted: 12,
  avgMatchPercent: 82,
  skillUsage: [
    { skill: 'Resume Match', count: 8 },
    { skill: 'Outreach Generator', count: 5 },
    { skill: 'Interview Coach', count: 3 },
  ],
};

const MOCK_FUNNEL: FunnelStage[] = [
  { stage: 'Discovered', count: 42 },
  { stage: 'Saved', count: 18 },
  { stage: 'Applied', count: 12 },
  { stage: 'Interview', count: 4 },
  { stage: 'Offer', count: 1 },
  { stage: 'Rejected', count: 5 },
];

const MOCK_TIME_SERIES: TimeSeriesPoint[] = [
  { week: '2026-04-01', applications: 2, matchAvg: 75 },
  { week: '2026-04-08', applications: 4, matchAvg: 82 },
  { week: '2026-04-15', applications: 3, matchAvg: 78 },
  { week: '2026-04-22', applications: 5, matchAvg: 85 },
];

// ── API calls ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  /**
   * GET /api/analytics/summary
   * Returns weekly stats: skills run, applications submitted, avg match %,
   * and per-skill usage counts for the skill usage chart.
   */
  getSummary: async (): Promise<AnalyticsSummary> => {
    if (USE_MOCKS) return MOCK_SUMMARY;
    const res = await api.get<AnalyticsSummary>('/analytics/summary');
    return res.data;
  },

  /**
   * GET /api/analytics/funnel
   * Returns ordered funnel stages:
   * Discovered → Saved → Applied → Interview → Offer → Rejected
   */
  getFunnel: async (): Promise<FunnelStage[]> => {
    if (USE_MOCKS) return MOCK_FUNNEL;
    const res = await api.get<FunnelStage[]>('/analytics/funnel');
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
    if (USE_MOCKS) return MOCK_TIME_SERIES;
    const res = await api.get<TimeSeriesPoint[]>('/analytics/time-series', {
      params: { weeks },
    });
    return res.data;
  },
};
