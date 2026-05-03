/**
 * analytics.ts — shared analytics domain types
 *
 * D5 fix: analyticsApi.ts defined SkillUsageItem, AnalyticsSummary,
 * FunnelStage, and TimeSeriesPoint locally. Moving them here prevents
 * duplicate, diverging definitions if another file (e.g. a chart component
 * or admin dashboard) imports these shapes independently.
 *
 * analyticsApi.ts now re-exports from here for backwards compatibility.
 */

export interface SkillUsageItem {
  skill: string;
  count: number;
}

export interface AnalyticsSummary {
  skillsRunThisWeek: number;
  applicationsSubmitted: number;
  avgMatchPercent: number;
  skillUsage: SkillUsageItem[];
}

export interface FunnelStage {
  stage: string;
  count: number;
}

/** One data point for the weekly trend chart */
export interface TimeSeriesPoint {
  /** ISO date string for Monday of that week, e.g. "2026-04-28" */
  week: string;
  applications: number;
  matchAvg: number;
}

export interface AnalyticsInsight {
  id: string;
  type: 'positive' | 'warning' | 'info';
  message: string;
  metric?: string;
  value?: number;
}
