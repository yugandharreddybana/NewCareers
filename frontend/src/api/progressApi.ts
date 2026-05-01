// Section 3.5 — typed API client for weekly progress, streaks, history
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

export interface HistoryResponse {
  weeks: WeeklySummaryResponse[];
  streak: StreakResponse;
}

export const progressApi = {
  // Task 61
  getWeeklySummary: () =>
    axios.get<WeeklySummaryResponse>('/progress/weekly-summary').then(r => r.data),

  // Task 62
  getStreaks: () =>
    axios.get<StreakResponse>('/progress/streaks').then(r => r.data),

  // Task 64 — record daily activity (call on page mount)
  recordActivity: () =>
    axios.post<StreakResponse>('/progress/activity').then(r => r.data),

  // Task 67 — multi-week history for chart widgets
  getHistory: (weeks = 8) =>
    axios.get<WeeklySummaryResponse[]>(`/progress/history?weeks=${weeks}`).then(r => r.data),

  // Task 68 — combined full data in one request
  getFull: () =>
    axios.get<HistoryResponse>('/progress/full').then(r => r.data),
};
