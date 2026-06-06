// Section 3.6 Tasks 69+70 — hook to fire onboarding/feature analytics events
// Usage: const { trackStep, trackFeature } = useOnboardingTracker();
import { useCallback } from 'react';
import { api as axios } from '@/services/api';
import { hasAnalyticsConsent, resolveAnalyticsConsent } from '@/lib/cookieConsent';

type OnboardingStep =
  | 'profile_complete'
  | 'first_job_saved'
  | 'first_skill_run'
  | 'planner_viewed'
  | 'first_application';

type FeatureKey =
  | 'cover_letter'
  | 'cv_tailor'
  | 'mock_interview'
  | 'planner'
  | 'networking'
  | 'progress'
  | 'workspace'
  | 'interview_kit';

async function analyticsAllowed(): Promise<boolean> {
  if (hasAnalyticsConsent()) return true;
  return resolveAnalyticsConsent();
}

export const useOnboardingTracker = () => {
  const trackStep = useCallback(
    (step: OnboardingStep, eventType: 'started' | 'completed' | 'dropped' = 'completed') => {
      void analyticsAllowed().then(ok => {
        if (!ok) return;
        axios
          .post('/onboarding/event', { type: 'onboarding', step, eventType })
          .catch(() => {});
      });
    },
    [],
  );

  const trackFeature = useCallback(
    (feature: FeatureKey, action: 'viewed' | 'first_use' | 'repeat_use' = 'first_use') => {
      void analyticsAllowed().then(ok => {
        if (!ok) return;
        axios
          .post('/onboarding/event', { type: 'feature', feature, action })
          .catch(() => {});
      });
    },
    [],
  );

  return { trackStep, trackFeature };
};
