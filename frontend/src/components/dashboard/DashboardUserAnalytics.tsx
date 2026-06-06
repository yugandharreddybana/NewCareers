import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2,
  ChevronRight,
  MessageSquare,
  Send,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  useAnalyticsSummary,
  useAnalyticsTimeSeries,
  useJobsStats,
} from '@/hooks/queries';
import type { TimeSeriesPoint } from '@/types/analytics';

function formatChartDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function buildTrendSeries(points: TimeSeriesPoint[]) {
  return points.map((point) => ({
    date: formatChartDate(point.week),
    applications: point.applications,
  }));
}

function MiniTrendChart({ data }: { data: { date: string; applications: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.applications), 1);
  if (data.length === 0) {
    return (
      <p className="text-body-sm text-secondary py-6 text-center">
        Activity will appear here once you track or apply to jobs.
      </p>
    );
  }
  return (
    <div className="flex items-end gap-1 h-20 w-full">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <div
            className="w-full bg-primary/70 rounded-t-sm min-h-0"
            style={{
              height: `${Math.max((d.applications / maxVal) * 64, d.applications > 0 ? 4 : 0)}px`,
            }}
            title={`${d.date}: ${d.applications}`}
          />
        </div>
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon,
  accentClass = 'bg-primary/10 text-primary',
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  accentClass?: string;
}) {
  return (
    <div className="flex flex-col p-5 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${accentClass}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-on-surface tabular-nums">{value}</p>
      <p className="font-label-md text-label-md text-on-surface mt-1">{label}</p>
      <p className="text-body-sm text-secondary mt-1">{hint}</p>
    </div>
  );
}

function FunnelRow({
  label,
  count,
  max,
  barClass,
}: {
  label: string;
  count: number;
  max: number;
  barClass: string;
}) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-body-sm">
        <span className="text-on-surface-variant">{label}</span>
        <span className="font-semibold text-on-surface tabular-nums">{count}</span>
      </div>
      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Compact user job-search analytics for the home dashboard (replaces Fast-Track). */
export function DashboardUserAnalytics() {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: kanbanStats, isLoading: statsLoading } = useJobsStats();
  const { data: trendPoints, isLoading: trendLoading } = useAnalyticsTimeSeries(8);

  const trend = useMemo(
    () => buildTrendSeries(trendPoints ?? []),
    [trendPoints],
  );

  const loading = summaryLoading || statsLoading || trendLoading;
  const s = kanbanStats ?? {
    total: 0,
    applied: 0,
    interviews: 0,
    offers: 0,
    avgMatch: 0,
  };
  const responseRate =
    s.applied > 0 ? Math.round((s.interviews / s.applied) * 100) : 0;

  return (
    <div
      className="bg-surface-container rounded-2xl p-8 md:p-12 welcome-stagger-in"
      style={{ animationDelay: '0.4s' }}
      aria-labelledby="dashboard-user-analytics-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2
            id="dashboard-user-analytics-heading"
            className="font-headline-md text-headline-md text-on-surface"
          >
            Your Analytics
          </h2>
          <p className="text-body-sm text-secondary mt-1">
            Job search performance at a glance — pipeline, applications, and match quality.
          </p>
        </div>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-1 text-primary font-label-md text-label-md hover:underline shrink-0"
        >
          Full analytics
          <ChevronRight size={16} />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-base animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-surface-container-lowest rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-base md:gap-gutter mb-8">
            <StatTile
              label="Jobs tracked"
              value={s.total}
              hint="Roles in your pipeline"
              icon={<BarChart2 size={18} />}
            />
            <StatTile
              label="Applications"
              value={summary?.applicationsSubmitted ?? s.applied}
              hint="Applied, interview, or offer"
              icon={<Send size={18} />}
              accentClass="bg-secondary-container text-on-secondary-container"
            />
            <StatTile
              label="Interviews"
              value={s.interviews}
              hint={`${responseRate}% response rate`}
              icon={<MessageSquare size={18} />}
              accentClass="bg-tertiary-container/30 text-on-surface"
            />
            <StatTile
              label="Avg match"
              value={`${summary?.avgMatchPercent ?? s.avgMatch}%`}
              hint="Profile fit across pipeline"
              icon={<Target size={18} />}
              accentClass="bg-primary/10 text-primary"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-base md:gap-gutter">
            <div className="p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-primary" />
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Weekly activity
                </h3>
              </div>
              <MiniTrendChart data={trend} />
              {trend.length > 0 && (
                <div className="flex justify-between mt-2 text-label-sm text-secondary">
                  <span>{trend[0]?.date}</span>
                  <span>{trend[trend.length - 1]?.date}</span>
                </div>
              )}
            </div>

            <div className="p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-primary" />
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Application funnel
                </h3>
              </div>
              <div className="space-y-3">
                <FunnelRow
                  label="Discovered"
                  count={s.total}
                  max={s.total}
                  barClass="bg-outline-variant"
                />
                <FunnelRow
                  label="Applied"
                  count={s.applied}
                  max={s.total}
                  barClass="bg-primary/60"
                />
                <FunnelRow
                  label="Interviews"
                  count={s.interviews}
                  max={s.total}
                  barClass="bg-primary"
                />
                <FunnelRow
                  label="Offers"
                  count={s.offers}
                  max={s.total}
                  barClass="bg-tertiary"
                />
              </div>
              {(summary?.skillsRunThisWeek ?? 0) > 0 && (
                <p className="text-body-sm text-secondary mt-4 pt-4 border-t border-outline-variant/50">
                  <span className="font-semibold text-on-surface">
                    {summary?.skillsRunThisWeek}
                  </span>{' '}
                  AI skill{summary?.skillsRunThisWeek === 1 ? '' : 's'} run this week
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
