import { useState, useCallback } from 'react';
import { skillsApi } from '../services/skillsApi';
import type {
  SkillName,
  SkillState,
  UseSkillState,
  SkillStartRequest,
  SkillRunResponse,
} from '../types/skills';

/**
 * useSkill — state machine hook for running CareerOps skills.
 *
 * State transitions:
 *   idle → loading → done           (happy path)
 *   idle → loading → waiting_answer → loading → done  (ask_user flow)
 *   idle → loading → profile_incomplete               (missing CV/profile)
 *   idle → loading → error                            (API error)
 *
 * Usage:
 *   const { state, data, question, startSkill, handleAnswer, downloadPdf } = useSkill();
 */
export function useSkill() {
  const [skillState, setSkillState] = useState<UseSkillState>({
    state:          'idle',
    data:           null,
    question:       null,
    conversationId: null,
    missingFields:  [],
    error:          null,
    skillName:      null,
  });

  // ── Start a skill ───────────────────────────────────────────
  const startSkill = useCallback(async (req: SkillStartRequest) => {
    setSkillState(prev => ({
      ...prev,
      state:     'loading',
      error:     null,
      skillName: req.skillName,
    }));

    try {
      const res = await skillsApi.start(req);
      applyResponse(res, req.skillName);
    } catch (err: unknown) {
      const msg = (err as { normalizedMessage?: string })?.normalizedMessage
               || 'Something went wrong. Please try again.';
      setSkillState(prev => ({ ...prev, state: 'error', error: msg }));
    }
  }, []);

  // ── Answer Claude's question ────────────────────────────────
  const handleAnswer = useCallback(async (answer: string) => {
    const { conversationId, skillName } = skillState;
    if (!conversationId || !skillName) return;

    setSkillState(prev => ({ ...prev, state: 'loading', error: null }));

    try {
      // Loop until Claude stops asking questions
      let res: SkillRunResponse = await skillsApi.reply({ conversationId, answer });

      // Handle chained questions (Claude may ask more than once)
      while (res.type === 'QUESTION') {
        setSkillState(prev => ({
          ...prev,
          state:          'waiting_answer',
          question:       res.question ?? null,
          conversationId: res.conversationId ?? null,
        }));
        // Return to let the user answer the next question via UI
        return;
      }

      applyResponse(res, skillName);
    } catch (err: unknown) {
      const msg = (err as { normalizedMessage?: string })?.normalizedMessage
               || 'Something went wrong. Please try again.';
      setSkillState(prev => ({ ...prev, state: 'error', error: msg }));
    }
  }, [skillState]);

  // ── Download PDF ────────────────────────────────────────────
  const downloadPdf = useCallback(async (
    userJobId: string,
    skillName: string
  ) => {
    try {
      await skillsApi.downloadSkillPdf(userJobId, skillName);
    } catch {
      console.error('PDF download failed');
    }
  }, []);

  // ── Reset to idle ───────────────────────────────────────────
  const reset = useCallback(() => {
    setSkillState({
      state:          'idle',
      data:           null,
      question:       null,
      conversationId: null,
      missingFields:  [],
      error:          null,
      skillName:      null,
    });
  }, []);

  // ── Internal response handler ───────────────────────────────
  function applyResponse(res: SkillRunResponse, skillName: SkillName) {
    switch (res.type) {
      case 'RESULT':
        setSkillState(prev => ({
          ...prev,
          state:    'done',
          data:     (res.data as Record<string, unknown>) ?? null,
          question: null,
          conversationId: null,
        }));
        break;

      case 'QUESTION':
        setSkillState(prev => ({
          ...prev,
          state:          'waiting_answer',
          question:       res.question ?? null,
          conversationId: res.conversationId ?? null,
        }));
        break;

      case 'PROFILE_INCOMPLETE':
        setSkillState(prev => ({
          ...prev,
          state:         'profile_incomplete',
          missingFields: res.missingFields ?? [],
        }));
        break;

      case 'ERROR':
        setSkillState(prev => ({
          ...prev,
          state: 'error',
          error: res.errorMessage ?? 'An error occurred.',
        }));
        break;
    }
  }

  return {
    // State
    state:          skillState.state,
    data:           skillState.data,
    question:       skillState.question,
    conversationId: skillState.conversationId,
    missingFields:  skillState.missingFields,
    error:          skillState.error,
    skillName:      skillState.skillName,
    isLoading:      skillState.state === 'loading',
    isDone:         skillState.state === 'done',
    needsAnswer:    skillState.state === 'waiting_answer',

    // Actions
    startSkill,
    handleAnswer,
    downloadPdf,
    reset,
  };
}
