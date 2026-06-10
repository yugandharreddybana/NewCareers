import { useUsageLimits } from '@/hooks/queries/useUsageLimits';
import { isCompleteUsageLimits } from '@/lib/usageLimitsUtils';

/** Shown in the top nav when the daily job-delivery quota is exhausted. */
export function NavJobLimitNotice() {
  const { data, isLoading } = useUsageLimits();

  if (isLoading || !isCompleteUsageLimits(data)) {
    return null;
  }

  const { remaining, limit } = data.jobDelivery;
  if (limit < 0 || remaining > 0) {
    return null;
  }

  return (
    <p
      className="hidden lg:block text-xs text-on-surface-variant max-w-[220px] text-right leading-snug shrink-0"
      role="status"
    >
      You have reached your daily limit of {limit} jobs. Come back tomorrow.
    </p>
  );
}
