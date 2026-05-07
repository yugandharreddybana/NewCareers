/**
 * autoApplyApi.ts — typed client for /auto-apply.
 *
 * Pass 6 #6.011 — consolidated from src/api/autoApplyApi.ts. The shape
 * preserved here is the one consumed by AutoApplyPage.tsx (AnswerBankEntry,
 * ApplicationRun, RunStep). The earlier services/ duplicate (AutoApplyAnswer,
 * AutoApplyRun) was a scaffolded stub; it is replaced by this canonical impl.
 */
import { api } from './api';

export interface AnswerBankEntry {
  id: string;
  questionKey: string;
  answerText: string;
  isDefault: boolean;
  updatedAt: string;
}

export interface RunStep {
  id: string;
  stepNumber: number;
  stepType: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  errorMessage: string | null;
  executedAt: string | null;
}

export interface ApplicationRun {
  id: string;
  userJobId: string;
  status: 'pending' | 'in_progress' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  totalSteps: number;
  completedSteps: number;
  errorMessage: string | null;
  resumeVersionId: string | null;
  approvedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  steps: RunStep[];
}

export const autoApplyApi = {
  listAnswers:  ()                                                   => api.get<AnswerBankEntry[]>('/auto-apply/answers').then(r => r.data),
  upsertAnswer: (body: { questionKey: string; answerText: string }) => api.post<AnswerBankEntry>('/auto-apply/answers', body).then(r => r.data),
  deleteAnswer: (id: string)                                         => api.delete(`/auto-apply/answers/${id}`),
  listRuns:     ()                                                   => api.get<{ runs: ApplicationRun[]; total: number }>('/auto-apply/history').then(r => r.data),
  getStatus:    (runId: string)                                      => api.get<ApplicationRun>(`/auto-apply/status/${runId}`).then(r => r.data),
  startRun:     (userJobId: string, resumeVersionId?: string)        => api.post<ApplicationRun>(`/auto-apply/start/${userJobId}`, { resumeVersionId }).then(r => r.data),
  approveRun:   (runId: string, approved: boolean)                   => api.post<ApplicationRun>(`/auto-apply/approve/${runId}`, { approved }).then(r => r.data),
  retryRun:     (runId: string)                                      => api.post<ApplicationRun>(`/auto-apply/retry/${runId}`).then(r => r.data),
};
