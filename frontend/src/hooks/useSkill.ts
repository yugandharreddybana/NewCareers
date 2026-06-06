import { useCallback, useState } from 'react';

import toast from 'react-hot-toast';

import { skillsApi } from '../services/skillsApi';

import type {
  SkillName,
  UseSkillState,
  SkillStartRequest,
  SkillRunResponse,
} from '../types/skills';

/** Skills that must never pause for ask_user — auto-run only. */
const AUTO_RUN_SKILLS = new Set<SkillName>([
  'research',
  'evaluate',
  'tailor-resume',
  'cover-letter',
  'prep-interview',
  'culture-fit',
  'salary-negotiation',
  'skills-gap-plan',
  'linkedin-optimize',
  'compare',
  'triage',
  'scan',
]);

/**
 * useSkill — state machine hook for running NewCareers skills.
 *
 * State transitions:
 *   idle → loading → done           (happy path)
 *   idle → loading → waiting_answer → loading → done  (ask_user flow)
 *   idle → loading → profile_incomplete               (missing CV/profile)
 *   idle → loading → error                            (API error)
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

  function applyResponse(res: SkillRunResponse, activeSkillName: SkillName | null = null) {
    switch (res.type) {
      case 'RESULT':
        setSkillState(prev => ({
          ...prev,
          state:    'done',
          data:     (res.data as Record<string, unknown>) ?? null,
          question: null,
          conversationId: null,
          missingFields: [],
          error: null,
          skillName: activeSkillName ?? prev.skillName,
        }));
        break;

      case 'QUESTION':
        if (activeSkillName && AUTO_RUN_SKILLS.has(activeSkillName)) {
          setSkillState(prev => ({
            ...prev,
            state: 'error',
            data: null,
            question: null,
            conversationId: null,
            missingFields: [],
            error: 'This skill runs automatically. Click Re-run to try again.',
            skillName: activeSkillName,
          }));
          break;
        }
        setSkillState(prev => ({
          ...prev,
          state:          'waiting_answer',
          question:       res.question ?? null,
          conversationId: res.conversationId ?? null,
          error:          null,
          skillName:      activeSkillName ?? prev.skillName,
        }));
        break;

      case 'PROFILE_INCOMPLETE':
        setSkillState(prev => ({
          ...prev,
          state:         'profile_incomplete',
          data:          null,
          question:      null,
          conversationId: null,
          missingFields: res.missingFields ?? [],
          error:         null,
          skillName:     activeSkillName ?? prev.skillName,
        }));
        break;

      case 'ERROR':
        setSkillState(prev => ({
          ...prev,
          state:    'error',
          data:     null,
          question: null,
          conversationId: null,
          error:    res.errorMessage ?? 'An error occurred.',
          skillName: activeSkillName ?? prev.skillName,
        }));
        break;

      default: {
        const exhaustiveCheck: never = res.type;
        throw new Error(`Unhandled skill response type: ${exhaustiveCheck}`);
      }
    }
  }

  const prepareSkill = useCallback((skillName: SkillName) => {
    setSkillState(prev => ({
      ...prev,
      state:     'loading',
      skillName,
      data:      null,
      question:  null,
      conversationId: null,
      missingFields: [],
      error:     null,
    }));
  }, []);

  const startSkill = useCallback(async (req: SkillStartRequest) => {
    setSkillState(prev => ({
      ...prev,
      state:     'loading',
      data:      null,
      question:  null,
      conversationId: null,
      missingFields: [],
      error:     null,
      skillName: req.skillName,
    }));

    try {
      const res = await skillsApi.start(req);
      applyResponse(res);
    } catch (err: unknown) {
      const msg = (err as { normalizedMessage?: string })?.normalizedMessage
               || 'Something went wrong. Please try again.';
      setSkillState(prev => ({ ...prev, state: 'error', error: msg }));
    }
  }, []);

  const handleAnswer = useCallback(async (answer: string) => {
    const { conversationId, skillName } = skillState;
    if (!conversationId || !skillName) return;

    setSkillState(prev => ({
      ...prev,
      state: 'loading',
      question: null,
      error: null,
    }));

    try {
      const res = await skillsApi.reply({ conversationId, answer });
      applyResponse(res, skillName);
    } catch (err: unknown) {
      const msg = (err as { normalizedMessage?: string })?.normalizedMessage
               || 'Something went wrong. Please try again.';
      setSkillState(prev => ({ ...prev, state: 'error', error: msg }));
    }
  }, [skillState]);

  const downloadPdf = useCallback(async (
    userJobId: string,
    skillName: string,
  ) => {
    try {
      await skillsApi.downloadSkillPdf(userJobId, skillName);
      setSkillState(prev => ({ ...prev, error: null }));
    } catch {
      const message = 'PDF download failed. Please try again.';
      setSkillState(prev => ({ ...prev, error: message }));
      toast.error(message);
    }
  }, []);

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

  const loadLastRun = useCallback(async (userJobId: string, skill: SkillName) => {
    try {
      const res = await skillsApi.getLastRun(userJobId, skill);
      if (!res) {
        return false;
      }
      if (res.type === 'RESULT' && res.data != null) {
        applyResponse(res, skill);
        return true;
      }
      if (res.type === 'ERROR') {
        return false;
      }
    } catch {
      // Any lookup failure means "no cached run" — never surface as a skill error.
    }
    return false;
  }, []);

  return {
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

    startSkill,
    prepareSkill,
    handleAnswer,
    downloadPdf,
    loadLastRun,
    reset,
  };
}
