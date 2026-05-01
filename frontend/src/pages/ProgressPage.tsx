// Section 3.5 — Tasks 63, 64, 65, 66, 67, 68 — ProgressPage (final)
import React, { useEffect, useState } from 'react';
import {
  progressApi,
  WeeklySummaryResponse,
  StreakResponse,
  HistoryResponse,
} from '../api/progressApi';
import { StreakBadges } from '../components/StreakBadges';
import { ProgressCharts } from '../components/ProgressCharts';

export const ProgressPage: React.FC = () => {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Record daily visit (Task 64 streak) then load full history (Tasks 67+68)
    progressApi
      .recordActivity()
      .catch(() => {}) // non-fatal
      .finally(() =>
        progressApi
          .getFull()
          .then(setData)
          .catch(() => setError('Failed to load progress data.'))
          .finally(() => setLoading(false))
      );
  }, []);

  const summary: WeeklySummaryResponse | undefined = data?.weeks?.[0];
  const streak: StreakResponse | undefined = data?.streak;
  const history: WeeklySummaryResponse[] = data?.weeks ?? [];

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton skeleton-heading" style={{ width: 220, marginBottom: 24 }} />
        <div className="progress-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-container progress-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Progress</h1>
          <p className="page-subtitle">
            {summary
              ? `Week of ${
                  new Date(summary.weekStart).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'long',
                  })
                }`
              : 'No data yet for this week'}
          </p>
        </div>
        {streak && (
          <div className="streak-hero" aria-label={`${streak.currentDailyStreak}-day streak`}>
            <span className="streak-flame" aria-hidden="true">🔥</span>
            <span className="streak-count">{streak.currentDailyStreak}</span>
            <span className="streak-label">day streak</span>
          </div>
        )}
      </div>

      {/* KPI grid */}
      {summary ? (
        <div className="progress-grid">
          {[
            { label: 'Jobs Reviewed',   value: summary.jobsReviewed,          icon: '🔍' },
            { label: 'Applications',    value: summary.applicationsSubmitted,  icon: '📤' },
            { label: 'Interviews',      value: summary.interviewsScheduled,    icon: '🎯' },
            { label: 'Responses',       value: summary.responsesReceived,      icon: '📬' },
            { label: 'Offers',          value: summary.offersReceived,         icon: '🏆' },
            {
              label: 'Response Rate',
              value: summary.responseRate != null ? `${summary.responseRate}%` : '—',
              icon: '📊',
            },
          ].map(kpi => (
            <div key={kpi.label} className="progress-kpi-card">
              <span className="kpi-icon" aria-hidden="true">{kpi.icon}</span>
              <span className="kpi-value">{kpi.value}</span>
              <span className="kpi-label">{kpi.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3>No activity this week yet</h3>
          <p>Start reviewing jobs and submitting applications to build your first weekly report.</p>
        </div>
      )}

      {/* AI Insights (Task 60) */}
      {summary && (
        <section className="insights-section">
          {summary.winsSummary && (
            <div className="insight-card insight-card--wins">
              <h3>🏅 This Week&rsquo;s Wins</h3>
              <p>{summary.winsSummary}</p>
            </div>
          )}
          {summary.bottlenecksSummary && (
            <div className="insight-card insight-card--bottleneck">
              <h3>⚠️ Bottleneck</h3>
              <p>{summary.bottlenecksSummary}</p>
            </div>
          )}
          {summary.recommendations && (
            <div className="insight-card insight-card--reco">
              <h3>💡 Recommendations</h3>
              <p>{summary.recommendations}</p>
            </div>
          )}
          {summary.bestPerformingCategory && (
            <div className="insight-card insight-card--category">
              <h3>⭐ Best Category</h3>
              <p>{summary.bestPerformingCategory}</p>
            </div>
          )}
        </section>
      )}

      {/* Task 67 — multi-week trend charts */}
      {history.length > 1 && (
        <section className="charts-section">
          <h2 className="section-heading">Trends (last {history.length} weeks)</h2>
          <ProgressCharts weeks={history} />
        </section>
      )}

      {/* Task 65 — badges */}
      {streak && (
        <section className="badges-section">
          <h2 className="section-heading">Milestones &amp; Badges</h2>
          <StreakBadges badges={streak.badges} />
        </section>
      )}

      {/* Streak detail */}
      {streak && (
        <section className="streak-detail">
          <h2 className="section-heading">Your Streaks</h2>
          <div className="streak-stats">
            {[
              { value: streak.currentDailyStreak, label: 'Current Streak' },
              { value: streak.longestDailyStreak,  label: 'Longest Streak' },
              { value: streak.totalJobsReviewed,   label: 'Total Jobs Reviewed' },
              { value: streak.totalAppsSubmitted,  label: 'Total Applications' },
            ].map(stat => (
              <div key={stat.label} className="streak-stat">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProgressPage;
