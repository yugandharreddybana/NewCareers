/**
 * watchlistsApi.ts — typed service layer for /api/watchlists
 *
 * Watchlists are saved job search queries that run on a cron schedule
 * and push new matches to the user’s pipeline automatically.
 */
import { api } from './api';

export interface Watchlist {
  id: string;
  name: string;
  query: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  isActive: boolean;
  lastRunAt: string | null;
  matchCount: number;
  createdAt: string;
}

export interface WatchlistRun {
  id: string;
  watchlistId: string;
  jobsFound: number;
  jobsAdded: number;
  ranAt: string;
  status: 'success' | 'error';
  errorMessage: string | null;
}

export const watchlistsApi = {
  getAll: () =>
    api.get<Watchlist[]>('/watchlists').then(r => r.data),

  create: (body: { name: string; query: string; location?: string; salaryMin?: number; salaryMax?: number }) =>
    api.post<Watchlist>('/watchlists', body).then(r => r.data),

  getOne: (id: string) =>
    api.get<Watchlist>(`/watchlists/${id}`).then(r => r.data),

  update: (id: string, body: Partial<Watchlist>) =>
    api.put<Watchlist>(`/watchlists/${id}`, body).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/watchlists/${id}`).then(r => r.data),

  toggle: (id: string) =>
    api.post<Watchlist>(`/watchlists/${id}/toggle`).then(r => r.data),

  getRuns: (id: string) =>
    api.get<WatchlistRun[]>(`/watchlists/${id}/runs`).then(r => r.data),

  /** AI-generated query suggestions derived from the user’s profile */
  getSuggestions: () =>
    api.get<{ query: string; location: string | null }[]>('/watchlists/suggestions').then(r => r.data),
};
