import { useCallback, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  interviewApi,
  type InterviewQuestion,
  type InterviewTrack,
} from '../services/interviewApi';
import { isApiError } from '@/types';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';

function getErrorMessage(error: unknown, fallback: string): string {
  return getUserFacingErrorMessage(error, fallback);
}

function isNotFoundError(error: unknown): boolean {
  if (isApiError(error) && error.status === 404) return true;
  if (isAxiosError(error) && error.response?.status === 404) return true;
  return false;
}

export function useInterview(userJobId: string) {
  const [track, setTrack] = useState<InterviewTrack | null>(null);
  const [kit, setKit] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trackLoadPromiseRef = useRef<Promise<InterviewTrack | null> | null>(null);

  const fetchTrack = useCallback(async (): Promise<InterviewTrack | null> => {
    if (trackLoadPromiseRef.current) {
      return trackLoadPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const nextTrack = await interviewApi.getTrack(userJobId);
        setTrack(nextTrack);
        return nextTrack;
      } catch (caughtError: unknown) {
        if (isNotFoundError(caughtError)) {
          setTrack(null);
          return null;
        }
        throw caughtError;
      } finally {
        trackLoadPromiseRef.current = null;
      }
    })();

    trackLoadPromiseRef.current = promise;
    return promise;
  }, [userJobId]);

  const loadTrack = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      return await fetchTrack();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Failed to load interview track'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchTrack]);

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
      trackLoadPromiseRef.current = null;
      await fetchTrack();
      return questions;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Failed to generate interview kit'));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [userJobId, fetchTrack]);

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
