// ============================================================
// CareerOps Skill Types
// Mirrors SkillRunResponse.java exactly
// ============================================================

export type SkillName =
  | 'evaluate'
  | 'tailor-resume'
  | 'cover-letter'
  | 'apply'
  | 'outreach'
  | 'research'
  | 'prep-interview'
  | 'compare'
  | 'triage'
  | 'scan'
  | 'salary-negotiation'
  | 'culture-fit'
  | 'linkedin-optimize'
  | 'skills-gap-plan'
  | 'track'
  | 'help';

export type SkillResponseType =
  | 'RESULT'
  | 'QUESTION'
  | 'PROFILE_INCOMPLETE'
  | 'ERROR';

/**
 * Unified response from POST /api/skills/start and POST /api/skills/conversation/reply
 * The frontend always receives this type and branches on `type`.
 */
export interface SkillRunResponse {
  type: SkillResponseType;

  // RESULT
  data?: Record<string, unknown> | null;
  skillName?: string;

  // QUESTION
  conversationId?: string;
  question?: string;

  // PROFILE_INCOMPLETE
  missingFields?: string[];

  // ERROR
  errorMessage?: string;
}

export interface SkillStartRequest {
  skillName: SkillName;
  userJobId?: string;
  channel?: 'linkedin' | 'email' | 'follow-up';
  tone?: 'professional' | 'conversational' | 'direct';
  step?: string;
  compareJobIds?: string[];
  scanTarget?: string;
}

export interface ConversationReplyRequest {
  conversationId: string;
  answer: string;
}

export interface RunAllSkillsResponse {
  total: number;
  succeeded: number;
  failed: number;
  pendingAnswers: number;
  results: Record<string, SkillRunResponse>;
}

export interface RunAllSkillsBatchStatus {
  id: string;
  userJobId: string;
  status: 'in_progress' | 'completed' | 'failed';
  total: number;
  completed: number;
  createdAt: string;
  results: Record<string, SkillRunResponse>;
}

// ── Hook State ──────────────────────────────────────────────

export type SkillState =
  | 'idle'
  | 'loading'
  | 'waiting_answer'
  | 'done'
  | 'error'
  | 'profile_incomplete';

export interface UseSkillState {
  state: SkillState;
  data: Record<string, unknown> | null;
  question: string | null;
  conversationId: string | null;
  missingFields: string[];
  error: string | null;
  skillName: SkillName | null;
}
