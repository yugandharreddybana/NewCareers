import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { jobsApi } from '@/services/api';
import { analyticsApi, type TimeSeriesPoint } from '@/services/analyticsApi';
import type { JobCard, JobsListResponse, Stats } from '@/types';
import {
  TrendingUp, Target, MessageSquare, Award,
  BarChart2, RefreshCw, ChevronRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface DailyPoint { date: string; applications: number; responses: number; }
interface FunnelStage { label: string; count: number; color: string; }
interface AnalyticsData {
  stats: Stats;
  dailySeries: DailyPoint[];
  topSources: { name: string; count: number }[];
  topRoles: { title: string; count: number; avgMatch: number }[];
}

const EMPTY_STATS: Stats = { total: 0, applied: 0, interviews: 0, offers: 0, avgMatch: 0 };

// ── Helpers ────────────────────────────────────────────────────────────────────
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

function buildMockData(): AnalyticsData {
  const today = Date.now();
  return {
    stats: { total: 42, applied: 12, interviews: 4, offers: 1, avgMatch: 78 },
    dailySeries: Array.from({ length: 14 }, (_, i) => ({
      date: new Date(today - (13 - i) * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      applications: Math.floor(Math.random() * 4),
      responses: Math.floor(Math.random() * 2),
    })),
    topSources: [
      { name: 'LinkedIn', count: 18 },
      { name: 'IrishJobs', count: 11 },
      { name: 'Indeed', count: 8 },
      { name: 'Direct', count: 5 },
    ],
    topRoles: [
      { title: 'Senior Full Stack Developer', count: 14, avgMatch: 84 },
      { title: 'Frontend Engineer', count: 10, avgMatch: 79 },
      { title: 'Tech Lead', count: 8, avgMatch: 72 },
      { title: 'Software Architect', count: 5, avgMatch: 68 },
    ],
  };
}

function formatChartDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function buildTrendSeries(points: TimeSeriesPoint[]): DailyPoint[] {
  return points.map(point => ({
    date: formatChartDate(point.week),
    applications: point.applications,
    responses: 0,
  }));
}

function buildTrendSeriesFromJobs(jobs: JobCard[]): DailyPoint[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const rawDate = job.deliveredAt ?? job.postedAt;
    if (!rawDate) continue;
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = parsed.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      date: formatChartDate(key),
      applications: counts.get(key) ?? 0,
      responses: 0,
    };
  });
}

function buildTopSources(jobs: JobCard[]): AnalyticsData['topSources'] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const source = job.sourceName?.trim() || 'Unknown';
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 5);
}

function buildTopRoles(jobs: JobCard[]): AnalyticsData['topRoles'] {
  const totals = new Map<string, { count: number; matchTotal: number; matchCount: number }>();
  for (const job of jobs) {
    const title = job.title?.trim();
    if (!title) continue;
    const current = totals.get(title) ?? { count: 0, matchTotal: 0, matchCount: 0 };
    current.count += 1;
    if (typeof job.matchPercent === 'number') {
      current.matchTotal += job.matchPercent;
      current.matchCount += 1;
    }
    totals.set(title, current);
  }

  return Array.from(totals.entries())
    .map(([title, summary]) => ({
      title,
      count: summary.count,
      avgMatch: summary.matchCount > 0 ? Math.round(summary.matchTotal / summary.matchCount) : 0,
    }))
    .sort((left, right) => right.count - left.count || right.avgMatch - left.avgMatch || left.title.localeCompare(right.title))
    .slice(0, 5);
}

function deriveStatsFromJobs(jobs: JobCard[]): Stats {
  const total = jobs.length;
  const applied = jobs.filter(job => !['Discovered', 'Saved'].includes(job.kanbanColumn)).length;
  const interviews = jobs.filter(job => ['Interview', 'Offer'].includes(job.kanbanColumn)).length;
  const offers = jobs.filter(job => job.kanbanColumn === 'Offer').length;
  const matchedJobs = jobs.filter(job => typeof job.matchPercent === 'number');
  const avgMatch = matchedJobs.length > 0
    ? Math.round(matchedJobs.reduce((sum, job) => sum + (job.matchPercent ?? 0), 0) / matchedJobs.length)
    : 0;

  return { total, applied, interviews, offers, avgMatch };
}

// ── Mini bar chart (pure CSS) ──────────────────────────────────────────────────
const MiniBarChart: React.FC<{ data: DailyPoint[] }> = ({ data }) => {
  const maxVal = Math.max(...data.map(d => d.applications), 1);
  return (
    <div className="flex items-end gap-1 h-24 w-full">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1 group relative">
          <div
            className="w-full bg-indigo-400 rounded-t-sm transition-all group-hover:bg-indigo-500"
            style={{ height: `${(d.applications / maxVal) * 80}px`, minHeight: d.applications > 0 ? 4 : 0 }}
          />
          {d.responses > 0 && (
            <div
              className="absolute bottom-0 w-full bg-emerald-400/60 rounded-t-sm"
              style={{ height: `${(d.responses / maxVal) * 80}px`, minHeight: 3 }}
            />
          )}
          {/* Tooltip */}
          <div className="absolute bottom-full mb-1.5 hidden group-hover:block z-10 pointer-events-none">
            <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-xl">
              {d.date}: {d.applications} apps{d.responses > 0 ? `, ${d.responses} replies` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Funnel bar ─────────────────────────────────────────────────────────────────
const FunnelBar: React.FC<{ stage: FunnelStage; max: number }> = ({ stage, max }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600 font-medium">{stage.label}</span>
      <span className="font-bold text-gray-900">{stage.count}</span>
    </div>
    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${stage.color}`}
        style={{ width: `${Math.max((stage.count / max) * 100, stage.count > 0 ? 3 : 0)}%` }}
      />
    </div>
  </div>
);

// ── Stat card ──────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; sub?: string; accent?: string }> = ({
  label, value, icon, sub, accent = 'bg-indigo-50 text-indigo-600',
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>{icon}</div>
    </div>
  </div>
);

// ── Main page ──────────────────────────────────────────────────────────────────
const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      if (USE_MOCKS) {
        await new Promise(r => setTimeout(r, 600));
        setData(buildMockData());
      } else {
        const [statsResult, jobsResult, trendResult] = await Promise.allSettled([
          jobsApi.stats() as Promise<Stats>,
          jobsApi.list() as Promise<JobsListResponse>,
          analyticsApi.getTimeSeries(8),
        ]);

        const jobs = jobsResult.status === 'fulfilled' ? jobsResult.value.items : [];
        const stats = statsResult.status === 'fulfilled'
          ? statsResult.value
          : (jobsResult.status === 'fulfilled' ? deriveStatsFromJobs(jobs) : null);

        if (!stats) {
          throw new Error('Analytics data unavailable');
        }

        setData({
          stats,
          dailySeries: trendResult.status === 'fulfilled' && trendResult.value.length > 0
            ? buildTrendSeries(trendResult.value)
            : buildTrendSeriesFromJobs(jobs),
          topSources: buildTopSources(jobs),
          topRoles: buildTopRoles(jobs),
        });
      }
    } catch {
      if (!data) setData({
        stats: EMPTY_STATS,
        dailySeries: [],
        topSources: [],
        topRoles: [],
      });
      toast.error('Failed to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading analytics…</div>
  );

  if (!data) return (
    <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Analytics are unavailable right now.</div>
  );

  const s = data.stats;
  const responseRate = s.applied > 0 ? Math.round((s.interviews / s.applied) * 100) : 0;
  const offerRate    = s.applied > 0 ? Math.round((s.offers / s.applied) * 100) : 0;
  const hasResponses = data.dailySeries.some(point => point.responses > 0);

  const funnel: FunnelStage[] = [
    { label: 'Jobs Discovered', count: s.total,      color: 'bg-gray-400' },
    { label: 'Applied',         count: s.applied,    color: 'bg-indigo-400' },
    { label: 'Interviews',      count: s.interviews, color: 'bg-blue-500' },
    { label: 'Offers',          count: s.offers,     color: 'bg-emerald-500' },
  ];

  return (
    <>
      <PageMeta title="Analytics — CareerOps" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Your job search performance at a glance.</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Jobs Tracked"  value={s.total}          icon={<BarChart2 size={17} />}    sub="all time" />
          <StatCard label="Applications"  value={s.applied}        icon={<Target size={17} />}       sub="submitted" accent="bg-blue-50 text-blue-600" />
          <StatCard label="Interviews"    value={s.interviews}     icon={<MessageSquare size={17} />} sub={`${responseRate}% response rate`} accent="bg-emerald-50 text-emerald-600" />
          <StatCard label="Avg Match"     value={`${s.avgMatch}%`} icon={<TrendingUp size={17} />}   sub="profile fit" accent="bg-purple-50 text-purple-600" />
        </div>

        {/* Applications trend */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Application Trend</h2>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 inline-block" /> Applications</span>
              {hasResponses && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/60 inline-block" /> Responses</span>}
            </div>
          </div>
          <MiniBarChart data={data.dailySeries} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">{data.dailySeries[0]?.date}</span>
            <span className="text-[10px] text-gray-400">{data.dailySeries[data.dailySeries.length - 1]?.date}</span>
          </div>
        </div>

        {/* Funnel + Sources grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Application funnel */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Application Funnel</h2>
            <div className="space-y-3">
              {funnel.map(f => <FunnelBar key={f.label} stage={f} max={s.total} />)}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500">Offer rate</span>
              <span className={`font-bold ${offerRate > 5 ? 'text-emerald-600' : 'text-gray-700'}`}>{offerRate}%</span>
            </div>
          </div>

          {/* Top sources */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Job Sources</h2>
            <div className="space-y-3">
              {data.topSources.length === 0 && (
                <p className="text-sm text-gray-500">No tracked job sources yet.</p>
              )}
              {data.topSources.map((src, i) => {
                const maxC = data.topSources[0]?.count ?? 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-medium">{src.name}</span>
                      <span className="font-bold text-gray-900">{src.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${maxC > 0 ? (src.count / maxC) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top role types */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Role Titles</h2>
          <div className="divide-y divide-gray-100">
            {data.topRoles.length === 0 && (
              <p className="py-3 text-sm text-gray-500">No tracked role data yet.</p>
            )}
            {data.topRoles.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-900">{r.title}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{r.count} jobs</span>
                  <span className={`font-bold ${ r.avgMatch >= 80 ? 'text-emerald-600' : r.avgMatch >= 65 ? 'text-yellow-600' : 'text-gray-500'}`}>{r.avgMatch}% match</span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievement banner */}
        {s.offers > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <Award size={20} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">You've received {s.offers} offer{s.offers > 1 ? 's' : ''}! 🎉</p>
              <p className="text-xs text-emerald-600 mt-0.5">That puts you in the top 10% of active job seekers on CareerOps.</p>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default AnalyticsPage;
