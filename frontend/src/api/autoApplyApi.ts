import axios from './axiosInstance';

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
  listAnswers:  ()                          => axios.get<AnswerBankEntry[]>('/auto-apply/answers').then(r => r.data),
  upsertAnswer: (body: { questionKey: string; answerText: string }) =>
                                               axios.post<AnswerBankEntry>('/auto-apply/answers', body).then(r => r.data),
  deleteAnswer: (id: string)               => axios.delete(`/auto-apply/answers/${id}`),
  listRuns:     ()                          => axios.get<{ runs: ApplicationRun[]; total: number }>('/auto-apply/history').then(r => r.data),
  getStatus:    (runId: string)             => axios.get<ApplicationRun>(`/auto-apply/status/${runId}`).then(r => r.data),
  startRun:     (userJobId: string, resumeVersionId?: string) =>
                                               axios.post<ApplicationRun>(`/auto-apply/start/${userJobId}`, { resumeVersionId }).then(r => r.data),
  approveRun:   (runId: string, approved: boolean) =>
                                               axios.post<ApplicationRun>(`/auto-apply/approve/${runId}`, { approved }).then(r => r.data),
};
