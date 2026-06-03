import { useAuth } from '@/context/AuthContext';
import { useUsageLimits } from '@/hooks/queries/useUsageLimits';
import { Tooltip } from '@/components/ui/Tooltip';
import type { DailyQuota } from '@/types';

function quotaTone(remaining: number, limit: number): string {
  if (limit <= 0) return 'border-outline-variant bg-surface-container text-secondary';
  const ratio = remaining / limit;
  if (remaining <= 0 || ratio <= 0) return 'border-red-400 bg-red-50 text-red-900 ring-1 ring-red-200';
  if (ratio < 0.15) return 'border-red-300 bg-red-50 text-red-800';
  if (ratio < 0.35) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

function atLimit(remaining: number, limit: number): boolean {
  return limit > 0 && remaining <= 0;
}

type YmdParts = { year: number; month: number; day: number };

function ymdInZone(date: Date, timeZone: string): YmdParts | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = Number(parts.find(p => p.type === 'year')?.value);
    const month = Number(parts.find(p => p.type === 'month')?.value);
    const day = Number(parts.find(p => p.type === 'day')?.value);
    if (!year || !month || !day) return null;
    return { year, month, day };
  } catch {
    return null;
  }
}

function isTomorrowInZone(today: YmdParts, target: YmdParts): boolean {
  const d = new Date(Date.UTC(today.year, today.month - 1, today.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.getUTCFullYear() === target.year && d.getUTCMonth() + 1 === target.month && d.getUTCDate() === target.day;
}

/** e.g. "Resets tomorrow at 12:00 AM GMT+1" or "Resets Wed, Jun 4 at 12:00 AM IST" */
function formatQuotaResetLine(iso: string, timeZone: string, resetDescription?: string): string {
  const reset = new Date(iso);
  if (Number.isNaN(reset.getTime())) {
    return resetDescription ? `Resets ${resetDescription}` : 'Resets at midnight';
  }

  const nowYmd = ymdInZone(new Date(), timeZone);
  const resetYmd = ymdInZone(reset, timeZone);
  if (!nowYmd || !resetYmd) {
    return 'Resets at midnight';
  }

  let dayLabel: string;
  if (nowYmd.year === resetYmd.year && nowYmd.month === resetYmd.month && nowYmd.day === resetYmd.day) {
    dayLabel = 'today';
  } else if (isTomorrowInZone(nowYmd, resetYmd)) {
    dayLabel = 'tomorrow';
  } else {
    dayLabel = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone,
    }).format(reset);
  }

  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(reset);

  return `Resets ${dayLabel} at ${timeLabel}`;
}

function buildQuotaTooltip(
  label: string,
  quota: DailyQuota,
  timeZone: string,
  valueFormatter: (n: number) => string,
  exhausted: boolean,
): string {
  const limit = Number(quota.limit);
  const remaining = Number(quota.remaining);
  const usageLine = exhausted
    ? `${label}: daily limit reached (${valueFormatter(limit)} used).`
    : `${label}: ${valueFormatter(remaining)} remaining of ${valueFormatter(limit)} today.`;
  const resetLine = formatQuotaResetLine(quota.resetsAt, timeZone, quota.resetDescription);
  const zoneLine = timeZone ? `Quota timezone: ${timeZone}.` : '';
  return [usageLine, resetLine, zoneLine].filter(Boolean).join('\n');
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function UsagePill({
  label,
  quota,
  timeZone,
  valueFormatter,
}: {
  label: string;
  quota: DailyQuota;
  timeZone: string;
  valueFormatter: (n: number) => string;
}) {
  const limit = Number(quota.limit);
  const remaining = Number(quota.remaining);
  const tone = quotaTone(remaining, limit);
  const exhausted = atLimit(remaining, limit);
  const tooltipText = buildQuotaTooltip(label, quota, timeZone, valueFormatter, exhausted);
  const ariaLabel = `${tooltipText.replace(/\n/g, '. ')}`;

  return (
    <Tooltip
      content={
        <span className="block max-w-[240px] whitespace-normal text-left leading-snug">
          {tooltipText.split('\n').map((line, i) => (
            <span
              key={`${i}-${line}`}
              className={
                i === 1
                  ? 'block mt-1 font-semibold text-white'
                  : i > 0
                    ? 'block mt-1 text-white/80 text-[11px]'
                    : 'block'
              }
            >
              {line}
            </span>
          ))}
        </span>
      }
      placement="bottom"
      delay={250}
      className="!whitespace-normal"
    >
      <div
        tabIndex={0}
        className={`flex flex-col gap-0.5 px-2 py-1 rounded-lg border min-w-[4.5rem] cursor-help ${tone}`}
        aria-label={ariaLabel}
      >
        <span className="text-[9px] uppercase tracking-wide opacity-75 leading-none">{label}</span>
        <span className="text-[11px] font-bold tabular-nums leading-tight">
          {valueFormatter(remaining)}
          <span className="font-normal opacity-60"> / {valueFormatter(limit)}</span>
        </span>
        {exhausted ? (
          <span className="text-[8px] font-semibold uppercase tracking-wide text-red-700 leading-none">
            Limit reached
          </span>
        ) : null}
      </div>
    </Tooltip>
  );
}

export function NavUsageLimits() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch, isFetching } = useUsageLimits();

  if (!user) return null;

  if (isLoading && !data) {
    return (
      <span className="text-[10px] text-secondary px-2" aria-live="polite">
        Loading usage…
      </span>
    );
  }

  if (isError || !data) {
    return (
      <button
        type="button"
        onClick={() => void refetch()}
        className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 hover:underline"
        title="Could not load daily usage. Click to retry."
      >
        Usage unavailable
      </button>
    );
  }

  const tz = data.timezoneId || 'Europe/Dublin';

  return (
    <div
      className="flex items-stretch gap-1.5 min-w-0"
      role="status"
      aria-label="Daily usage limits"
      aria-busy={isFetching}
    >
      <UsagePill
        label="Jobs today"
        quota={data.jobDelivery}
        timeZone={tz}
        valueFormatter={n => String(n)}
      />
      <UsagePill
        label="AI tokens"
        quota={data.aiTokens}
        timeZone={tz}
        valueFormatter={formatTokens}
      />
    </div>
  );
}
