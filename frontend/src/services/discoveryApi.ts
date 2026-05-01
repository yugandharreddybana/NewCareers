/**
 * Section 7 — Task 75 (API layer)
 * Discovery API service.
 * Covers recommended jobs and keyword search endpoints.
 *
 * Section 3.3 fix: removed duplicate /api prefix.
 * The `api` axios instance already has baseURL = .../api,
 * so paths here must be /jobs/... not /api/jobs/...
 */

import { api } from './api';
import type { JobCard } from '@/types';

// ── Response types ───────────────────────────────────────────────────────────

export interface RecommendedJob {
  userJobId:      string;
  title:          string;
  company:        string;
  location:       string;
  matchPercent:   number;
  salaryMin?:     number;
  salaryMax?:     number;
  currency?:      string;
  sourceUrl?:     string;
  sourceName?:    string;
  postedAt?:      string;
  whyRecommended: string;
}

export interface SearchParams {
  q?:           string;
  location?:    string;
  minSalary?:   number;
  maxSalary?:   number;
  sponsorship?: boolean;
  remote?:      boolean;
  page?:        number;
  size?:        number;
}

export interface SearchResult {
  items:      JobCard[];
  total:      number;
  page:       number;
  size:       number;
  totalPages: number;
}

// ── API calls ───────────────────────────────────────────────────────────────

export const discoveryApi = {
  /**
   * GET /api/jobs/recommended  (baseURL already includes /api)
   * Returns top 5 jobs from the user's Discovered pipeline
   * with a whyRecommended label per job.
   */
  getRecommended: async (): Promise<RecommendedJob[]> => {
    const res = await api.get<RecommendedJob[]>('/jobs/recommended');
    return res.data;
  },

  /**
   * GET /api/jobs/search  (baseURL already includes /api)
   * Server-side filtered search within the user's pipeline.
   * All params optional — omit to return full pipeline.
   */
  search: async (params: SearchParams): Promise<SearchResult> => {
    // Strip undefined / empty values before sending
    const clean: Record<string, string | number | boolean> = {};
    (Object.entries(params) as [string, unknown][]).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) {
        clean[k] = v as string | number | boolean;
      }
    });
    const res = await api.get<SearchResult>('/jobs/search', { params: clean });
    return res.data;
  },
};
