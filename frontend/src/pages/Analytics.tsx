/**
 * Analytics — /analytics
 *
 * Four visualisations:
 *   1. Headline stats row    — skills run, applications submitted, avg match %
 *   2. Application funnel    — vertical bar chart (Discovered → Offer → Rejected)
 *   3. Weekly trend chart    — line chart: applications + match avg over last 8 weeks (NEW)
 *   4. Skill usage           — horizontal bar chart (most-used skill at top)
 *
 * All charts use Recharts. Empty states shown when no data exists.
 * Batch 4: added weekly trend line chart wired to GET /api/analytics/time-series
 */

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  analyticsApi,
  AnalyticsSummary,
  FunnelStage,
  TimeSeriesPoint,
} from '@/services/analyticsApi';
import { BarChart2, Zap, Send, Target, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Colour palette per funnel stage ───────────────────────────────────

const FUNNEL_COLOURS: Record<string, string> = {
  Discovered: '#6366F1',
  Saved:      '#8B5CF6',
  Applied:    '#F59E0B',
  Interview:  '#10B981',
  Offer:      '#22C55E',
  Rejected:   '#EF4444',
};

const SKILL_COLOUR = '#6366F1';

// ── Sub-components ─────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  colour: string;
}

function StatCard({ icon, label, value, sub, colour }: StatCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${colour}18` }}
      >
        <span style={{ color: colour }}>{icon}</span>
      </div>
      <div>
        <p className="text-3xl font-black text-slate-900 leading-none">{value}</p>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <BarChart2 size={32} className="text-slate-200" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

// ── Custom tooltips ────────────────────────────────────────────────────

function FunnelTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { stage, count } = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-800">{stage}</p>
      <p className="text-slate-500">{count} job{count !== 1 ? 's' : ''}</p>
    </div>
  );
}

function SkillTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { skill, count } = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-800 capitalize">{skill.replace(/-/g, ' ')}</p>
      <p className="text-slate-500">{count} run{count !== 1 ? 's' : ''}</p>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">w/c {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="text-xs">
          {p.name}: <span className="font-bold">{p.value}{p.dataKey === 'matchAvg' ? '%' : ''}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

// No dummy data — real data loads from analyticsApi

export default function Analytics() {
  const [summary,    setSummary]    = useState<AnalyticsSummary | null>(null);
  const [funnel,     setFunnel]     = useState<FunnelStage[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, f, ts] = await Promise.all([
          analyticsApi.getSummary(),
          analyticsApi.getFunnel(),
          analyticsApi.getTimeSeries(8),
        ]);
        setSummary(s);
        setFunnel(f);
        setTimeSeries(ts);
      } catch (e: any) {
        toast.error(e?.normalizedMessage || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const skillUsage = summary?.skillUsage ?? [];

  const skillUsageDisplay = skillUsage.map(s => ({
    ...s,
    label: s.skill.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }));

  // Format week label as "Apr 28" from "2026-04-28"
  const trendData = timeSeries.map(p => ({
    ...p,
    weekLabel: new Date(p.week + 'T00:00:00Z').toLocaleDateString('en-GB', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    }),
  }));

  const totalFunnelJobs = funnel.reduce((sum, s) => sum + s.count, 0);
  const totalSkillRuns  = skillUsage.reduce((sum, s) => sum + s.count, 0);
  const hasTrend        = trendData.length > 0;

  return (
    <div className="space-y-8 pb-20">

      {/* ── Page header ── */}
      <section className="pt-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <TrendingUp size={18} className="text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Your job search performance — skills used, applications sent, match quality.
        </p>
      </section>

      {/* ── Headline stats row ── */}
      <section>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <StatCard
              icon={<Zap size={20} />}
              label="Skills Run This Week"
              value={summary?.skillsRunThisWeek ?? 0}
              sub={`${totalSkillRuns} total all time`}
              colour="#6366F1"
            />
            <StatCard
              icon={<Send size={20} />}
              label="Applications Submitted"
              value={summary?.applicationsSubmitted ?? 0}
              sub="Applied + Interview + Offer"
              colour="#F59E0B"
            />
            <StatCard
              icon={<Target size={20} />}
              label="Avg Match Score"
              value={`${summary?.avgMatchPercent ?? 0}%`}
              sub="Across all sourced jobs"
              colour="#10B981"
            />
          </motion.div>
        )}
      </section>

      {/* ── Application funnel chart ── */}
      <section>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800">Application Funnel</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {totalFunnelJobs} total job{totalFunnelJobs !== 1 ? 's' : ''} across all stages
              </p>
            </div>
          </div>
          <div className="px-6 py-6">
            {loading ? (
              <div className="h-64 animate-pulse bg-slate-50 rounded-xl" />
            ) : totalFunnelJobs === 0 ? (
              <EmptyChart message="No jobs tracked yet — scan the market from your Dashboard to get started." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={funnel}
                  margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
                  barSize={40}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 12, fill: '#94A3B8', fontWeight: 500 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#CBD5E1' }}
                    axisLine={false} tickLine={false} allowDecimals={false}
                  />
                  <Tooltip content={<FunnelTooltip />} cursor={{ fill: '#F8FAFC' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {funnel.map((entry) => (
                      <Cell key={entry.stage} fill={FUNNEL_COLOURS[entry.stage] ?? '#6366F1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {!loading && totalFunnelJobs > 0 && (
            <div className="flex flex-wrap gap-3 px-6 pb-5">
              {funnel.map(({ stage, count }) => (
                <div key={stage} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: FUNNEL_COLOURS[stage] ?? '#6366F1' }}
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    {stage} <span className="text-slate-400">({count})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Weekly trend chart (NEW) ── */}
      <section>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Weekly Activity Trend</h2>
            <p className="text-xs text-slate-400 mt-0.5">Applications moved to pipeline + avg match score — last 8 weeks</p>
          </div>
          <div className="px-6 py-6">
            {loading ? (
              <div className="h-56 animate-pulse bg-slate-50 rounded-xl" />
            ) : !hasTrend ? (
              <EmptyChart message="No application activity in the last 8 weeks yet." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={trendData}
                  margin={{ top: 4, right: 16, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    yAxisId="apps"
                    tick={{ fontSize: 11, fill: '#CBD5E1' }}
                    axisLine={false} tickLine={false} allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="match"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#CBD5E1' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#94A3B8', paddingTop: 12 }}
                    formatter={(value) => value === 'applications' ? 'Applications' : 'Avg Match %'}
                  />
                  <Line
                    yAxisId="apps"
                    type="monotone"
                    dataKey="applications"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#F59E0B' }}
                    activeDot={{ r: 5 }}
                    name="applications"
                  />
                  <Line
                    yAxisId="match"
                    type="monotone"
                    dataKey="matchAvg"
                    stroke="#10B981"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: '#10B981' }}
                    activeDot={{ r: 5 }}
                    name="matchAvg"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ── Skill usage chart ── */}
      <section>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800">Skill Usage</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {totalSkillRuns} total skill run{totalSkillRuns !== 1 ? 's' : ''} all time
              </p>
            </div>
          </div>
          <div className="px-6 py-6">
            {loading ? (
              <div className="h-64 animate-pulse bg-slate-50 rounded-xl" />
            ) : skillUsageDisplay.length === 0 ? (
              <EmptyChart message="No skills run yet — open any job and run an AI skill to see data here." />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(200, skillUsageDisplay.length * 44)}
              >
                <BarChart
                  layout="vertical"
                  data={skillUsageDisplay}
                  margin={{ top: 4, right: 24, left: 4, bottom: 0 }}
                  barSize={22}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#CBD5E1' }}
                    axisLine={false} tickLine={false} allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={{ fontSize: 12, fill: '#64748B', fontWeight: 500 }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip content={<SkillTooltip />} cursor={{ fill: '#F8FAFC' }} />
                  <Bar dataKey="count" fill={SKILL_COLOUR} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
