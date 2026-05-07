/**
 * watchlistsApi.ts — typed client for /watchlists.
 *
 * Pass 6 #6.011 — consolidated from src/api/watchlistApi.ts (singular).
 * The canonical filename (plural) matches the backend route. A singular
 * alias is kept below for any legacy import.
 */
import { api } from './api';

export interface Watchlist {
  id: string;
  name: string;
  queryKeywords: string | null;
  location: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  remoteOnly: boolean;
  sponsorshipRequired: boolean;
  minMatchScore: number;
  alertEmail: boolean;
  alertInApp: boolean;
  status: 'active' | 'paused';
  lastRunAt: string | null;
  matchedTotal: number;
  clickedTotal: number;
  appliedTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistRun {
  id: string;
  watchlistId: string;
  matchedCount: number;
  newCount: number;
  runAt: string;
}

export const watchlistsApi = {
  list:           ()                                                => api.get<{ watchlists: Watchlist[]; total: number }>('/watchlists').then(r => r.data),
  create:         (body: Partial<Watchlist>)                        => api.post<Watchlist>('/watchlists', body).then(r => r.data),
  get:            (id: string)                                      => api.get<Watchlist>(`/watchlists/${id}`).then(r => r.data),
  update:         (id: string, body: Partial<Watchlist>)            => api.put<Watchlist>(`/watchlists/${id}`, body).then(r => r.data),
  delete:         (id: string)                                      => api.delete(`/watchlists/${id}`),
  toggle:         (id: string)                                      => api.post<Watchlist>(`/watchlists/${id}/toggle`).then(r => r.data),
  getRuns:        (id: string)                                      => api.get<WatchlistRun[]>(`/watchlists/${id}/runs`).then(r => r.data),
  getSuggestions: ()                                                => api.get<string[]>('/watchlists/suggestions').then(r => r.data),
};

/** Singular alias kept for any legacy import: `import { watchlistApi } from '...'` */
export const watchlistApi = watchlistsApi;
