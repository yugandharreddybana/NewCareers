import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import * as mocks from '@/services/mockApi';
import { progressApi, type StreakResponse, type WeeklySummaryResponse } from '@/services/progressApi';
import toast from 'react-hot-toast';
import { Flame, Trophy, Target, TrendingUp, CheckCircle, Lock, RefreshCw } from 'lucide-react';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const MOCK_WEEKLY: WeeklySummaryResponse = mocks.MOCK_WEEKLY_SUMMARY;
const MOCK_STREAKS: StreakResponse = mocks.MOCK_STREAKS;

// ── Badge card ─────────────────────────────────────────────────────────────────
const BadgeCard: React.FC<{ badge: StreakResponse['badges'][number] }> = ({ badge }) => (
  <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
    badge.earned
      ? 'bg-white border-amber-200 shadow-sm'
      : 'bg-gray-50 border-gray-200 opacity-50'
  }`}>
    <span className={`text-3xl ${ badge.earned ? '' : 'grayscale' }`}>{badge.icon}</span>
    <p className="text-xs font-semibold text-gray-700 text-center">{badge.label}</p>
    {badge.earned
      ? <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-bold"><CheckCircle size={10} /> Earned</span>
      : <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Lock size={10} /> Locked</span>
    }
  </div>
);

// ── Metric row ─────────────────────────────────────────────────────────────────
const MetricRow: React.FC<{ label: string; value: string | number; good?: boolean | undefined }> = ({ label, value, good }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-600">{label}</span>
    <span className={`text-sm font-bold ${ good === true ? 'text-emerald-600' : good === false ? 'text-red-500' : 'text-gray-900'}`}>
      {value}
    </span>
  </div>
);

// ── Main page ──────────────────────────────────────────────────────────────────
const ProgressPage: React.FC = () => {
  const [weekly, setWeekly] = useState<WeeklySummaryResponse | null>(null);
  const [streaks, setStreaks] = useState<StreakResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      setLoadError(null);
      if (USE_MOCKS) {
        await new Promise(r => setTimeout(r, 500));
        setWeekly(MOCK_WEEKLY);
        setStreaks(MOCK_STREAKS);
      } else {
        const [w, s] = await Promise.all([
          progressApi.getWeeklySummary(),
          progressApi.getStreaks(),
        ]);
        setWeekly(w);
        setStreaks(s);
      }
    } catch {
      const message = 'Failed to load progress.';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading progress…</div>
  );

  if (!weekly || !streaks) return (
    <>
      <PageMeta title="Progress — CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-gray-900">Progress unavailable</h1>
          <p className="text-sm text-gray-500">{loadError ?? 'Progress data is not available yet.'}</p>
          <button
            onClick={() => { void load(); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    </>
  );

  const w = weekly!;
  const s = streaks!;
  const weekLabel = `${new Date(w.weekStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(w.weekEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
  const formatRate = (value: number | null): string => value === null ? 'N/A' : `${Math.round(value * 100)}%`;

  return (
    <>
      <PageMeta title="Progress — CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Progress</h1>
            <p className="text-sm text-gray-500 mt-1">Track your streaks, milestones and weekly performance.</p>
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

        {/* Streak hero */}
        <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Flame size={20} className="text-white" />
                <span className="text-sm font-semibold opacity-90">Daily Streak</span>
              </div>
              <p className="text-5xl font-black">{s.currentDailyStreak}</p>
              <p className="text-sm opacity-80 mt-1">days in a row</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-70 mb-0.5">All-time best</p>
              <p className="text-2xl font-bold">{s.longestDailyStreak}</p>
              <p className="text-xs opacity-70 mt-3">Total jobs reviewed</p>
              <p className="text-xl font-bold">{s.totalJobsReviewed}</p>
            </div>
          </div>
        </div>

        {/* Weekly summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">This Week</h2>
            <span className="text-xs text-gray-400">{weekLabel}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Jobs Reviewed',   value: w.jobsReviewed,           icon: <Target size={16} />   },
              { label: 'Applications',    value: w.applicationsSubmitted,  icon: <TrendingUp size={16} /> },
              { label: 'Interviews',      value: w.interviewsScheduled,    icon: <Trophy size={16} />   },
              { label: 'Responses',       value: w.responsesReceived,      icon: <CheckCircle size={16} /> },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="flex justify-center text-indigo-500 mb-1">{m.icon}</div>
                <p className="text-xl font-bold text-gray-900">{m.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          <div>
            <MetricRow label="Response Rate" value={formatRate(w.responseRate)} good={w.responseRate !== null ? w.responseRate > 0.2 : undefined} />
            <MetricRow label="Interview Rate" value={formatRate(w.interviewRate)} good={w.interviewRate !== null ? w.interviewRate > 0.05 : undefined} />
            <MetricRow label="Offers Received" value={w.offersReceived} good={w.offersReceived > 0} />
          </div>
        </div>

        {/* AI Insights */}
        {(w.winsSummary || w.bottlenecksSummary || w.recommendations) && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">AI Insights</h2>
            {w.winsSummary && (
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-700 mb-1">🏆 Wins this week</p>
                <p className="text-sm text-emerald-800">{w.winsSummary}</p>
              </div>
            )}
            {w.bottlenecksSummary && (
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-700 mb-1">⚠️ Bottlenecks</p>
                <p className="text-sm text-amber-800">{w.bottlenecksSummary}</p>
              </div>
            )}
            {w.recommendations && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-700 mb-1">💡 Recommendation</p>
                <p className="text-sm text-blue-800">{w.recommendations}</p>
              </div>
            )}
          </div>
        )}

        {/* Badges */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Achievements</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {s.badges.map(b => <BadgeCard key={b.key} badge={b} />)}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">
            {s.badges.filter(b => b.earned).length} of {s.badges.length} badges earned
          </p>
        </div>

      </div>
    </>
  );
};

export default ProgressPage;
