/**
 * experimentsApi.ts — typed service layer for /api/experiments
 */
import { api } from './api';

export interface ExperimentVariant {
  key: string;
  variant: string;
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

function normalizeVariants(
  data: ExperimentVariant[] | Record<string, string>,
): ExperimentVariant[] {
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([key, variant]) => ({
    key,
    variant,
    payload: null,
  }));
}

export const experimentsApi = {
  getAllVariants: (): Promise<ExperimentVariant[]> =>
    api
      .get<ExperimentVariant[] | Record<string, string>>('/experiments/variants')
      .then(r => normalizeVariants(r.data)),

  getVariant: (key: string): Promise<ExperimentVariant> =>
    api.get<ExperimentVariant>(`/experiments/variant/${key}`).then(r => r.data),

  getAdminResults: (): Promise<ExperimentResults[]> =>
    api.get<ExperimentResults[]>('/experiments/admin/results').then(r => r.data),

  createExperiment: (body: {
    key: string;
    name: string;
    variants: string[];
    trafficPercent: number;
  }): Promise<Experiment> =>
    api.post<Experiment>('/experiments/admin', body).then(r => r.data),

  toggleStatus: (id: string): Promise<Experiment> =>
    api.patch<Experiment>(`/experiments/admin/${id}/status`).then(r => r.data),
};
