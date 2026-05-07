import { useCallback, useState } from 'react';
import {
  interviewApi,
  type InterviewQuestion,
  type InterviewTrack,
} from '../services/interviewApi';

const getErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

export function useInterview(userJobId: string) {
  const [track, setTrack] = useState<InterviewTrack | null>(null);
  const [kit, setKit] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrack = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const tracks = await interviewApi.listTracks();
      const nextTrack = tracks.find(candidate => candidate.userJobId === userJobId) ?? null;
      setTrack(nextTrack);
      return nextTrack;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Failed to load interview track'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [userJobId]);

  const generateKit = useCallback(async (
    companyName = '',
    roleTitle = '',
    jobDescription = '',
  ) => {
    setLoading(true);
    setError(null);

    try {
      const questions = await interviewApi.generateKit(userJobId, companyName, roleTitle, jobDescription);
      setKit(questions);

      const tracks = await interviewApi.listTracks();
      const nextTrack = tracks.find(candidate => candidate.userJobId === userJobId) ?? null;
      setTrack(nextTrack);

      return questions;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Failed to generate interview kit'));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [userJobId]);

  const loadKit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const questions = await interviewApi.getKit(userJobId);
      setKit(questions);
      return questions;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Failed to load interview kit'));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [userJobId]);

  const updateStage = useCallback(async (stage: string) => {
    setError(null);

    try {
      const updated = await interviewApi.updateStage(userJobId, stage);
      setTrack(updated);
      return updated;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Failed to update stage'));
      return undefined;
    }
  }, [userJobId]);

  return {
    track,
    kit,
    loading,
    error,
    loadTrack,
    generateKit,
    loadKit,
    updateStage,
  };
}