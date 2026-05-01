import { useState, useCallback } from 'react';
import { interviewApi } from '../services/interviewApi';
import type {
  InterviewTrack,
  InterviewSession,
  InterviewQuestion,
  AnswerResult,
} from '../types/interview';

export function useInterview(userJobId: string) {
  const [track, setTrack] = useState<InterviewTrack | null>(null);
  const [kit, setKit] = useState<InterviewQuestion[]>([]);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrack = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await interviewApi.getOrCreateTrack(userJobId);
      setTrack(t);
      return t;
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load interview track');
    } finally {
      setLoading(false);
    }
  }, [userJobId]);

  const generateKit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const questions = await interviewApi.generateKit(userJobId);
      setKit(questions);
      return questions;
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to generate interview kit');
    } finally {
      setLoading(false);
    }
  }, [userJobId]);

  const loadKit = useCallback(async (trackId: string) => {
    setLoading(true);
    setError(null);
    try {
      const questions = await interviewApi.getKit(trackId);
      setKit(questions);
      return questions;
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load kit');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStage = useCallback(async (trackId: string, stage: string) => {
    try {
      const updated = await interviewApi.updateStage(trackId, stage);
      setTrack(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to update stage');
    }
  }, []);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await interviewApi.startSession(userJobId);
      setSession(s);
      return s;
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to start session');
    } finally {
      setLoading(false);
    }
  }, [userJobId]);

  const submitAnswer = useCallback(async (
    sessionId: string,
    questionId: string,
    answer: string
  ): Promise<AnswerResult | undefined> => {
    setLoading(true);
    setError(null);
    try {
      return await interviewApi.submitAnswer(sessionId, questionId, answer);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit answer');
    } finally {
      setLoading(false);
    }
  }, []);

  const completeSession = useCallback(async (sessionId: string) => {
    try {
      const completed = await interviewApi.completeSession(sessionId);
      setSession(completed);
      return completed;
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to complete session');
    }
  }, []);

  const loadSessionHistory = useCallback(async () => {
    try {
      const history = await interviewApi.getSessionHistory(userJobId);
      setSessionHistory(history);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load history');
    }
  }, [userJobId]);

  return {
    track,
    kit,
    session,
    sessionHistory,
    loading,
    error,
    loadTrack,
    generateKit,
    loadKit,
    updateStage,
    startSession,
    submitAnswer,
    completeSession,
    loadSessionHistory,
  };
}
