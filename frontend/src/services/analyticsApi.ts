/**
 * Analytics API service.
 */

import type { AnalyticsSummary, FunnelStage, TimeSeriesPoint } from '@/types/analytics';
export type { AnalyticsSummary, FunnelStage, SkillUsageItem, TimeSeriesPoint } from '@/types/analytics';
import { api } from './api';

export const analyticsApi = {
  getSummary: (): Promise<AnalyticsSummary> =>
    api.get<AnalyticsSummary>('/analytics/summary').then(r => r.data),

  getFunnel: (): Promise<FunnelStage[]> =>
    api.get<FunnelStage[]>('/analytics/funnel').then(r => r.data),

  getTimeSeries: (weeks = 8): Promise<TimeSeriesPoint[]> =>
    api.get<TimeSeriesPoint[]>('/analytics/time-series', {
      params: { weeks },
    }).then(r => r.data),
};
