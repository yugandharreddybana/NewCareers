// Section 3.5 — Tasks 63, 64, 65, 66, 67, 68
import React, { useEffect, useState } from 'react';
import { progressApi, WeeklySummaryResponse, StreakResponse } from '../api/progressApi';
import { StreakBadges } from '../components/StreakBadges';
import { ProgressCharts } from '../components/ProgressCharts';

export const ProgressPage: React.FC = () => {
  const [summary, setSummary] = useState<WeeklySummaryResponse | null>(null);
  const [streak, setStreak] = useState<StreakResponse | null>(null);
  const [history, setHistory] = useState<WeeklySummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      progressApi.getWeeklySummary(),
      progressApi.getStreaks(),
      progressApi.recordActivity(),   // record daily visit for streak
    ])
      .then(([weekData, streakData]) => {
        setSummary(weekData);
        setStreak(streakData);
        setHistory([weekData]); // extend with historical endpoint when added
      })
      .catch(() => setError('Failed to load progress data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton skeleton-heading" style={{ width: 220, marginBottom: 24 }} />
        <div className="progress-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Progress</h1>
          <p className="page-subtitle">
            Week of {summary ? new Date(summary.weekStart).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' }) : '—'}
          </p>
        </div>
        {streak && (
          <div className="streak-hero">
            <span className="streak-flame">🔥</span>
            <span className="streak-count">{streak.currentDailyStreak}</span>
            <span className="streak-label">day streak</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="progress-grid">
          {[
            { label: 'Jobs Reviewed',    value: summary.jobsReviewed,          icon: '🔍' },
            { label: 'Applications',     value: summary.applicationsSubmitted,  icon: '📤' },
            { label: 'Interviews',       value: summary.interviewsScheduled,    icon: '🎯' },
            { label: 'Responses',        value: summary.responsesReceived,      icon: '📬' },
            { label: 'Offers',           value: summary.offersReceived,         icon: '🏆' },
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
      )}

      {/* AI Insights */}
      {summary && (
        <section className="insights-section">
          {summary.winsSummary && (
            <div className="insight-card insight-card--wins">
              <h3>🏅 This Week's Wins</h3>
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

      {/* Task 67 — Chart widgets */}
      {history.length > 0 && <ProgressCharts weeks={history} />}

      {/* Task 65 — Badges */}
      {streak && (
        <section className="badges-section">
          <h2 className="section-heading">Milestones & Badges</h2>
          <StreakBadges badges={streak.badges} />
        </section>
      )}

      {/* Streak detail */}
      {streak && (
        <section className="streak-detail">
          <h2 className="section-heading">Streaks</h2>
          <div className="streak-stats">
            <div className="streak-stat">
              <span className="stat-value">{streak.currentDailyStreak}</span>
              <span className="stat-label">Current Streak</span>
            </div>
            <div className="streak-stat">
              <span className="stat-value">{streak.longestDailyStreak}</span>
              <span className="stat-label">Longest Streak</span>
            </div>
            <div className="streak-stat">
              <span className="stat-value">{streak.totalJobsReviewed}</span>
              <span className="stat-label">Total Jobs Reviewed</span>
            </div>
            <div className="streak-stat">
              <span className="stat-value">{streak.totalAppsSubmitted}</span>
              <span className="stat-label">Total Applications</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ProgressPage;
