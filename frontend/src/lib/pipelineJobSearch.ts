import { onboardingApi, jobsApi } from '@/services/api';
import type { OnboardingDeliveryStatus } from '@/services/api';
import type { FetchSummary } from '@/types';
import { messageForDeliveryStage } from '@/lib/completeOnboardingFinish';

const ACTIVE_DELIVERY_STAGES = new Set([
  'reading_cv',
  'normalizing_cv',
  'fetching_jobs',
  'evaluating_jobs',
]);

const POLL_MS = 1500;
const TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function isActiveDeliveryStage(stage?: string): boolean {
  return ACTIVE_DELIVERY_STAGES.has(stage?.toLowerCase() ?? '');
}

/** Poll onboarding delivery until matches are ready or the run fails. */
export async function pollPipelineJobSearch(
  onProgress?: (status: OnboardingDeliveryStatus) => void,
): Promise<OnboardingDeliveryStatus> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await onboardingApi.deliveryStatus();
    const normalized: OnboardingDeliveryStatus = {
      ...status,
      message: messageForDeliveryStage(status.stage, status.message),
    };
    onProgress?.(normalized);
    if (status.ready || status.readyPartial) {
      return normalized;
    }
    if (status.stage === 'failed') {
      throw new Error(
        status.error ??
          status.message ??
          'Job matching could not complete. Try again or adjust your profile.',
      );
    }
    await sleep(POLL_MS);
  }
  throw new Error(
    'Job matching is taking longer than expected. Refresh the page — more roles may still be loading.',
  );
}

export type PipelineFetchResult = {
  delivered: number;
  fullSearch: boolean;
};

/**
 * POST /jobs/fetch — when the pipeline is empty the API starts full search;
 * this helper polls until jobs are ready, then callers should invalidate jobs queries.
 */
export async function fetchJobsOrchestrated(
  count: number,
  onProgress?: (status: OnboardingDeliveryStatus) => void,
): Promise<PipelineFetchResult> {
  const summary: FetchSummary = await jobsApi.fetch(count);
  if (summary.fullSearchStarted) {
    await pollPipelineJobSearch(onProgress);
    return { delivered: 0, fullSearch: true };
  }
  return { delivered: summary.delivered ?? 0, fullSearch: false };
}
