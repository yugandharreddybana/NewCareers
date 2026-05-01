import { api } from './api';
import type {
  InterviewTrack,
  InterviewSession,
  InterviewQuestion,
  AnswerResult,
} from '../types/interview';

export const interviewApi = {

  // ── Track ──────────────────────────────────────────────────
  getOrCreateTrack: (userJobId: string): Promise<InterviewTrack> =>
    api.post(`/api/interview/track?userJobId=${userJobId}`).then(r => r.data),

  getMyTracks: (): Promise<InterviewTrack[]> =>
    api.get('/api/interview/tracks').then(r => r.data),

  updateStage: (trackId: string, stage: string): Promise<InterviewTrack> =>
    api.patch(`/api/interview/track/${trackId}/stage?stage=${stage}`).then(r => r.data),

  // ── Question Kit ───────────────────────────────────────────
  generateKit: (userJobId: string): Promise<InterviewQuestion[]> =>
    api.post(`/api/interview/kit?userJobId=${userJobId}`, null, { timeout: 60_000 }).then(r => r.data),

  getKit: (trackId: string): Promise<InterviewQuestion[]> =>
    api.get(`/api/interview/kit/${trackId}`).then(r => r.data),

  // ── Mock Session ───────────────────────────────────────────
  startSession: (userJobId: string): Promise<InterviewSession> =>
    api.post(`/api/interview/session/start?userJobId=${userJobId}`).then(r => r.data),

  submitAnswer: (sessionId: string, questionId: string, answer: string): Promise<AnswerResult> =>
    api.post(`/api/interview/session/${sessionId}/answer?questionId=${questionId}`, { answer }, { timeout: 30_000 }).then(r => r.data),

  completeSession: (sessionId: string): Promise<InterviewSession> =>
    api.post(`/api/interview/session/${sessionId}/complete`).then(r => r.data),

  getSessionHistory: (userJobId: string): Promise<InterviewSession[]> =>
    api.get(`/api/interview/session/history?userJobId=${userJobId}`).then(r => r.data),
};
