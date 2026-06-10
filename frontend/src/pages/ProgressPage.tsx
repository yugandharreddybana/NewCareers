import React, { useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { useWeeklyProgress, useProgressStreaks } from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import toast from 'react-hot-toast';
import { Flame, Trophy, Target, TrendingUp, CheckCircle, Lock, RefreshCw } from 'lucide-react';

const BadgeCard: React.FC<{ badge: { icon: string; label: string; earned: boolean } }> = ({ badge }) => (
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

const MetricRow: React.FC<{ label: string; value: string | number; good?: boolean | undefined }> = ({ label, value, good }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-600">{label}</span>
    <span className={`text-sm font-bold ${ good === true ? 'text-emerald-600' : good === false ? 'text-red-500' : 'text-gray-900'}`}>
      {value}
    </span>
  </div>
);

const ProgressPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: weekly,
    isLoading: weeklyLoading,
    isError: weeklyError,
  } = useWeeklyProgress();
  const {
    data: streaks,
    isLoading: streaksLoading,
    isError: streaksError,
  } = useProgressStreaks();

  const loading = weeklyLoading || streaksLoading;
  const loadError = weeklyError || streaksError ? 'Failed to load progress.' : null;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    } catch {
      toast.error('Failed to load progress.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!weekly || !streaks) return (
    <>
      <PageMeta title="Progress — NewCareers" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-gray-900">Progress unavailable</h1>
          <p className="text-sm text-gray-500">{loadError ?? 'Progress data is not available yet.'}</p>
          <button
            onClick={() => { void refresh(); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <PageMeta title="Progress — NewCareers" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Your Progress</h1>
            <p className="text-sm text-gray-500 mt-1">Track streaks, weekly goals, and achievements.</p>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
              <Flame size={22} className="text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Current streak</p>
              <p className="text-2xl font-bold text-gray-900">{streaks.currentDailyStreak} days</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <Trophy size={22} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Longest streak</p>
              <p className="text-2xl font-bold text-gray-900">{streaks.longestDailyStreak} days</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target size={16} className="text-indigo-500" />
            This week ({weekly.weekStart} – {weekly.weekEnd})
          </h2>
          <MetricRow label="Jobs reviewed" value={weekly.jobsReviewed} />
          <MetricRow label="Applications submitted" value={weekly.applicationsSubmitted} good={weekly.applicationsSubmitted > 0} />
          <MetricRow label="Interviews scheduled" value={weekly.interviewsScheduled} />
          <MetricRow label="Responses received" value={weekly.responsesReceived} />
          <MetricRow label="Offers received" value={weekly.offersReceived} good={weekly.offersReceived > 0} />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            All-time activity
          </h2>
          <MetricRow label="Total jobs reviewed" value={streaks.totalJobsReviewed} />
          <MetricRow label="Total applications" value={streaks.totalAppsSubmitted} />
        </div>

        {streaks.badges.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Badges</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {streaks.badges.map(badge => (
                <BadgeCard key={badge.key} badge={badge} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProgressPage;
