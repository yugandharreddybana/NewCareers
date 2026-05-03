/**
 * experimentsApi.ts — typed service layer for /api/experiments
 *
 * Client-side A/B experiment variant loading.
 * Admin endpoints (create / toggle / results) are also exposed here
 * but should only be called from admin-gated pages.
 */
import { api } from './api';

export interface ExperimentVariant {
  key: string;
  variant: string;   // e.g. 'control' | 'treatment_a'
  payload: Record<string, unknown> | null;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  variants: string[];
  trafficPercent: number;
  createdAt: string;
}

export interface ExperimentResults {
  id: string;
  key: string;
  variants: {
    name: string;
    participants: number;
    conversions: number;
    conversionRate: number;
    isWinner: boolean;
  }[];
}

export const experimentsApi = {
  // ── User-facing ─────────────────────────────────────────────────────

  /** Load all active experiment variants on app boot (used by ExperimentContext) */
  getAllVariants: () =>
    api.get<ExperimentVariant[]>('/experiments/variants').then(r => r.data),

  /** Fetch a single variant by experiment key */
  getVariant: (key: string) =>
    api.get<ExperimentVariant>(`/experiments/variant/${key}`).then(r => r.data),

  // ── Admin ─────────────────────────────────────────────────────────────

  /** Get results for all experiments (ADMIN only) */
  getAdminResults: () =>
    api.get<ExperimentResults[]>('/experiments/admin/results').then(r => r.data),

  /** Create a new experiment (ADMIN only) */
  createExperiment: (body: {
    key: string;
    name: string;
    variants: string[];
    trafficPercent: number;
  }) => api.post<Experiment>('/experiments/admin', body).then(r => r.data),

  /** Toggle experiment status active ↔ paused (ADMIN only) */
  toggleStatus: (id: string) =>
    api.patch<Experiment>(`/experiments/admin/${id}/status`).then(r => r.data),
};
