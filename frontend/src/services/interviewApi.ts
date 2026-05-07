/**
 * interviewApi.ts — Phase 3.1 Interview Command Center API service
 */
import { api } from './api';

export interface InterviewQuestion {
  id: string;
  question: string;
  modelAnswer?: string;
  userAnswer?: string;
  score?: number;
  skillArea?: string;
  companyName?: string;
  roleTitle?: string;
  turnNumber: number;
  createdAt: string;
}

export interface InterviewSession {
  id: string;
  userJobId: string;
  trackId?: string;
  mode: string;
  status: 'in_progress' | 'completed';
  overallScore?: number;
  strengths?: string;
  weaknesses?: string;
  startedAt: string;
  completedAt?: string;
}

export interface InterviewTrack {
  id: string;
  userJobId: string;
  companyName?: string;
  roleTitle?: string;
  currentStage: string;
  interviewDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockStartResponse {
  sessionId: string;
  totalQuestions: number;
  currentTurn: number;
  question: string;
  questionId: string;
  skillArea: string;
}

export interface MockReplyResponse {
  score: number;
  feedback: string;
  sessionComplete: boolean;
  overallScore: number;
  nextQuestion: string;
  nextQuestionId: string;
  answeredCount: number;
}

const BASE = '/interviews';

export const interviewApi = {
  generateKit: (userJobId: string, companyName: string, roleTitle: string, jobDescription: string) =>
    api.post<InterviewQuestion[]>(`${BASE}/generate-kit/${userJobId}`, {
      companyName, roleTitle, jobDescription,
    }).then(r => r.data),

  getKit: (userJobId: string) =>
    api.get<InterviewQuestion[]>(`${BASE}/kit/${userJobId}`).then(r => r.data),

  startMock: (userJobId: string, trackId?: string) =>
    api.post<MockStartResponse>(`${BASE}/mock/start/${userJobId}`, { trackId }).then(r => r.data),

  replyMock: (sessionId: string, questionId: string, answer: string) =>
    api.post<MockReplyResponse>(`${BASE}/mock/reply/${sessionId}`, { questionId, answer }).then(r => r.data),

  historyForJob: (userJobId: string) =>
    api.get<InterviewSession[]>(`${BASE}/history/${userJobId}`).then(r => r.data),

  historyForUser: () =>
    api.get<InterviewSession[]>(`${BASE}/history`).then(r => r.data),

  listTracks: () =>
    api.get<InterviewTrack[]>(`${BASE}/tracks`).then(r => r.data),

  updateStage: (userJobId: string, stage: string) =>
    api.patch<InterviewTrack>(`${BASE}/tracks/${userJobId}/stage`, { stage }).then(r => r.data),
};
