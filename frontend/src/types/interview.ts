export interface InterviewTrack {
  id: string;
  userJobId: string;
  userId: string;
  companyName: string | null;
  roleTitle: string | null;
  currentStage: string;
  interviewDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewSession {
  id: string;
  interviewTrackId: string;
  userId: string;
  mode: string;
  overallScore: number | null;
  feedbackSummary: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface InterviewQuestion {
  id: string;
  interviewTrackId: string;
  sessionId: string | null;
  companyName: string | null;
  roleTitle: string | null;
  skillArea: string;
  question: string;
  expectedAnswer: string | null;
  userAnswer: string | null;
  score: number | null;
  aiFeedback: string | null;
  questionType: string;
  createdAt: string;
}

export interface AnswerResult {
  score: number;
  feedback: string;
  strengths: string;
  improvements: string;
}

export type InterviewStage =
  | 'APPLIED'
  | 'PHONE_SCREEN'
  | 'TECHNICAL_TEST'
  | 'FIRST_INTERVIEW'
  | 'SECOND_INTERVIEW'
  | 'FINAL_ROUND'
  | 'OFFER'
  | 'REJECTED';
