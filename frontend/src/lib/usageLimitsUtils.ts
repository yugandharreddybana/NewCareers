import type { UsageLimits } from '@/types';

/** True when /usage/limits includes all nav quota blocks (post nav-usage-quotas API). */
export function isCompleteUsageLimits(data: UsageLimits | undefined): data is UsageLimits {
  return Boolean(data?.jobDelivery && data?.aiTokens && data?.skillRuns);
}
