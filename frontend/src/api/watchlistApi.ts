import axios from './axiosInstance';

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

export const watchlistApi = {
  list:        ()                      => axios.get<{ watchlists: Watchlist[]; total: number }>('/watchlists').then(r => r.data),
  create:      (body: Partial<Watchlist>) => axios.post<Watchlist>('/watchlists', body).then(r => r.data),
  get:         (id: string)            => axios.get<Watchlist>(`/watchlists/${id}`).then(r => r.data),
  update:      (id: string, body: Partial<Watchlist>) => axios.put<Watchlist>(`/watchlists/${id}`, body).then(r => r.data),
  delete:      (id: string)            => axios.delete(`/watchlists/${id}`),
  toggle:      (id: string)            => axios.post<Watchlist>(`/watchlists/${id}/toggle`).then(r => r.data),
  getRuns:     (id: string)            => axios.get<WatchlistRun[]>(`/watchlists/${id}/runs`).then(r => r.data),
};
