/**
 * progressApi.ts — typed client for /progress.
 *
 * Pass 6 #6.011 — consolidated from src/api/progressApi.ts. The shape
 * preserved here is what ProgressCharts/StreakBadges use (BadgeDTO,
 * StreakResponse, WeeklySummaryResponse, HistoryResponse). Earlier
 * services/ duplicate (WeeklySummary etc.) was a scaffolded stub.
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
  getWeeklySummary: () =>
    api.get<WeeklySummaryResponse>('/progress/weekly-summary').then(r => r.data),

  getStreaks: () =>
    api.get<StreakResponse>('/progress/streaks').then(r => r.data),

  recordActivity: () =>
    api.post<StreakResponse>('/progress/activity').then(r => r.data),

  getHistory: (weeks = 8) =>
    api.get<WeeklySummaryResponse[]>(`/progress/history?weeks=${weeks}`).then(r => r.data),

  getFull: () =>
    api.get<HistoryResponse>('/progress/full').then(r => r.data),
};
