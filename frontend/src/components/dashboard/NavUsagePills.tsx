import type { DailyQuota, PeriodQuota } from '@/types';
import { useUsageLimits } from '@/hooks/queries/useUsageLimits';
import { isCompleteUsageLimits } from '@/lib/usageLimitsUtils';

function compactCount(value: number): string {
  if (value < 0) return '∞';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(value);
}

function pillTone(remaining: number, limit: number): string {
  if (limit < 0 || remaining < 0) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (limit === 0) return 'bg-red-50 text-red-800 border-red-200';
  const ratio = remaining / limit;
  if (ratio <= 0.2) return 'bg-red-50 text-red-800 border-red-200';
  if (ratio <= 0.5) return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-emerald-50 text-emerald-800 border-emerald-200';
}

function formatResetTooltip(quota: DailyQuota | PeriodQuota): string {
  const resetAt = new Date(quota.resetsAt);
  const when = Number.isNaN(resetAt.getTime())
    ? quota.resetsAt
    : resetAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return `${quota.resetDescription} (${when})`;
}

function UsagePill({
  label,
  remaining,
  limit,
  quota,
}: {
  label: string;
  remaining: number;
  limit: number;
  quota: DailyQuota | PeriodQuota;
}) {
  const displayRemaining = limit < 0 ? '∞' : compactCount(remaining);
  const displayLimit = limit < 0 ? '∞' : compactCount(limit);

  return (
    <span
      className={`hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-full border font-label-sm text-label-sm whitespace-nowrap ${pillTone(remaining, limit)}`}
      title={`${label}: ${displayRemaining} / ${displayLimit} left. ${formatResetTooltip(quota)}`}
      aria-label={`${label}: ${displayRemaining} of ${displayLimit} remaining`}
    >
      <span className="opacity-80">{label}</span>
      <span className="font-medium tabular-nums">
        {displayRemaining}
        <span className="opacity-60"> / {displayLimit}</span>
      </span>
    </span>
  );
}

export function NavUsagePills() {
  const { data, isError, isLoading, refetch, isFetching } = useUsageLimits();

  if (isLoading) {
    return (
      <div className="hidden md:flex items-center gap-2 shrink-0" aria-hidden>
        <span className="h-7 w-20 rounded-full bg-surface-container animate-pulse" />
        <span className="h-7 w-24 rounded-full bg-surface-container animate-pulse" />
        <span className="h-7 w-20 rounded-full bg-surface-container animate-pulse" />
      </div>
    );
  }

  if (isError || !isCompleteUsageLimits(data)) {
    return (
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <span className="font-label-sm text-label-sm text-on-surface-variant">Usage unavailable</span>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="font-label-sm text-label-sm text-primary hover:underline disabled:opacity-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0 min-w-0">
      <UsagePill
        label="Jobs"
        remaining={data.jobDelivery.remaining}
        limit={data.jobDelivery.limit}
        quota={data.jobDelivery}
      />
      <UsagePill
        label="Tokens"
        remaining={data.aiTokens.remaining}
        limit={data.aiTokens.limit}
        quota={data.aiTokens}
      />
      <UsagePill
        label="Skills"
        remaining={data.skillRuns.remaining}
        limit={data.skillRuns.limit}
        quota={data.skillRuns}
      />
    </div>
  );
}
