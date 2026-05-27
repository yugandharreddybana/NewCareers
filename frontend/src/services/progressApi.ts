/**
 * progressApi.ts — typed client for /progress.
 */
import { api } from './api';

export interface BadgeDTO {
  key: string;
  label: string;
  icon: string;
  earned: boolean;
}

export interface StreakResponse {
  currentDailyStreak: number;
  longestDailyStreak: number;
  lastActiveDate: string | null;
  totalJobsReviewed: number;
  totalAppsSubmitted: number;
  badges: BadgeDTO[];
}

export interface WeeklySummaryResponse {
  id: string;
  weekStart: string;
  weekEnd: string;
  jobsReviewed: number;
  applicationsSubmitted: number;
  interviewsScheduled: number;
  responsesReceived: number;
  offersReceived: number;
  dailyUseStreak: number;
  winsSummary: string | null;
  bottlenecksSummary: string | null;
  recommendations: string | null;
  bestPerformingCategory: string | null;
  responseRate: number | null;
  interviewRate: number | null;
  createdAt: string;
}

export interface HistoryResponse {
  weeks: WeeklySummaryResponse[];
  streak: StreakResponse;
}

export const progressApi = {
  getWeeklySummary: (): Promise<WeeklySummaryResponse> =>
    api.get<WeeklySummaryResponse>('/progress/weekly-summary').then(r => r.data),

  getStreaks: (): Promise<StreakResponse> =>
    api.get<StreakResponse>('/progress/streaks').then(r => r.data),

  recordActivity: (): Promise<StreakResponse> =>
    api.post<StreakResponse>('/progress/activity').then(r => r.data),

  getHistory: (weeks = 8): Promise<WeeklySummaryResponse[]> =>
    api.get<WeeklySummaryResponse[]>(`/progress/history?weeks=${weeks}`).then(r => r.data),

  getFull: (): Promise<HistoryResponse> =>
    api.get<HistoryResponse>('/progress/full').then(r => r.data),
};
