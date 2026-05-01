// Section 3.5 — typed API client for progress & streaks
import axios from './axiosInstance';

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

export const progressApi = {
  getWeeklySummary: () =>
    axios.get<WeeklySummaryResponse>('/progress/weekly-summary').then(r => r.data),

  getStreaks: () =>
    axios.get<StreakResponse>('/progress/streaks').then(r => r.data),

  recordActivity: () =>
    axios.post<StreakResponse>('/progress/activity').then(r => r.data),
};
