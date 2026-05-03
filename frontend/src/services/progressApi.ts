/**
 * progressApi.ts — typed service layer for /api/progress
 *
 * Covers weekly stats, activity streaks, multi-week chart history,
 * and activity recording for the gamification engine.
 */
import { api } from './api';

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  applicationsSubmitted: number;
  skillsRun: number;
  interviewsScheduled: number;
  offersReceived: number;
  avgMatchPercent: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  isActiveToday: boolean;
}

export interface ProgressHistory {
  weeks: WeeklySummary[];
  streak: StreakData;
}

export const progressApi = {
  /** Weekly summary for the current week */
  getWeeklySummary: () =>
    api.get<WeeklySummary>('/progress/weekly-summary').then(r => r.data),

  /** Current and longest activity streaks */
  getStreaks: () =>
    api.get<StreakData>('/progress/streaks').then(r => r.data),

  /**
   * Multi-week chart data
   * @param weeks Number of weeks of history to fetch (default: 8)
   */
  getHistory: (weeks = 8) =>
    api.get<WeeklySummary[]>('/progress/history', { params: { weeks } }).then(r => r.data),

  /** Combined history + streak in a single round-trip */
  getFull: () =>
    api.get<ProgressHistory>('/progress/full').then(r => r.data),

  /** Record a daily activity event (triggers streak update on backend) */
  recordActivity: (type: string, metadata?: Record<string, unknown>) =>
    api.post('/progress/activity', { type, metadata }).then(r => r.data),
};
