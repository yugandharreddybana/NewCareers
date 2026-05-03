/**
 * autoApplyApi.ts — typed service layer for /api/auto-apply
 *
 * Auto-apply orchestrates a Playwright-powered browser agent that fills
 * and submits job applications on behalf of the user with human-in-the-loop
 * approval before final submission.
 */
import { api } from './api';

export interface AutoApplyAnswer {
  id: string;
  question: string;
  answer: string;
  category: 'experience' | 'education' | 'skills' | 'personal' | 'other';
}

export type AutoApplyRunStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'approved'
  | 'submitted'
  | 'failed'
  | 'cancelled';

export interface AutoApplyStep {
  name: string;
  status: 'pending' | 'done' | 'failed';
  message: string | null;
  screenshotUrl: string | null;
}

export interface AutoApplyRun {
  id: string;
  userJobId: string;
  jobTitle: string;
  company: string;
  status: AutoApplyRunStatus;
  steps: AutoApplyStep[];
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export const autoApplyApi = {
  // ── Answer bank ───────────────────────────────────────────────────
  getAnswers: () =>
    api.get<AutoApplyAnswer[]>('/auto-apply/answers').then(r => r.data),

  upsertAnswer: (body: Omit<AutoApplyAnswer, 'id'> & { id?: string }) =>
    api.post<AutoApplyAnswer>('/auto-apply/answers', body).then(r => r.data),

  deleteAnswer: (id: string) =>
    api.delete(`/auto-apply/answers/${id}`).then(r => r.data),

  // ── Runs ───────────────────────────────────────────────────────────
  getHistory: () =>
    api.get<AutoApplyRun[]>('/auto-apply/history').then(r => r.data),

  getStatus: (runId: string) =>
    api.get<AutoApplyRun>(`/auto-apply/status/${runId}`).then(r => r.data),

  start: (userJobId: string) =>
    api.post<AutoApplyRun>(`/auto-apply/start/${userJobId}`).then(r => r.data),

  approve: (runId: string, approved: boolean) =>
    api.post(`/auto-apply/approve/${runId}`, { approved }).then(r => r.data),

  retry: (runId: string) =>
    api.post<AutoApplyRun>(`/auto-apply/retry/${runId}`).then(r => r.data),
};
