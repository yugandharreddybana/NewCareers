// Task 16 — InterviewHistoryPage: session timeline with weaknesses summary
import React, { useEffect, useState } from 'react';
import axios from '../api/axiosInstance';

interface Session {
  id: string;
  userJobId: string;
  status: string;
  score: number;
  turnCount: number;
  startedAt: string;
  completedAt: string | null;
  transcriptJson: string;
}

const SCORE_COLOR = (s: number) =>
  s >= 8 ? '#437a22' : s >= 5 ? '#d19900' : '#a12c7b';

const parseWeaknesses = (transcriptJson: string): string[] => {
  try {
    const turns = JSON.parse(transcriptJson);
    const tips: string[] = [];
    for (const t of turns) {
      if (t.scoreData?.tips) tips.push(...t.scoreData.tips);
    }
    // Deduplicate and return top 5
    return [...new Set(tips)].slice(0, 5);
  } catch {
    return [];
  }
};

export const InterviewHistoryPage: React.FC = () => {
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    // Get all sessions across all jobs for this user
    axios.get<Session[]>('/interviews/history/all')
      .then(r => setSessions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-container">
      {[1,2,3].map(i => <div key={i} className="skeleton skeleton-text" style={{ height: '64px', marginBottom: '12px' }} />)}
    </div>
  );

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Interview History</h1>
          <p className="page-subtitle">All mock interview sessions and your progress over time</p>
        </div>
      </header>

      {sessions.length === 0 && (
        <div className="empty-state-card empty-state-card--default">
          <div className="empty-state-card__icon">🎙️</div>
          <h3 className="empty-state-card__title">No sessions yet</h3>
          <p className="empty-state-card__desc">Open a saved job and start a mock interview to see your history here.</p>
        </div>
      )}

      <div className="history-timeline">
        {sessions.map(session => {
          const weaknesses = parseWeaknesses(session.transcriptJson);
          const isOpen = expanded === session.id;
          return (
            <div key={session.id} className="history-item">
              <button
                className="history-item__header"
                onClick={() => setExpanded(isOpen ? null : session.id)}
                aria-expanded={isOpen}
              >
                <div className="history-item__left">
                  <span
                    className="history-score-circle"
                    style={{ borderColor: SCORE_COLOR(session.score), color: SCORE_COLOR(session.score) }}
                    aria-label={`Score ${session.score} out of 10`}
                  >
                    {session.score}
                  </span>
                  <div>
                    <p className="history-item__date">
                      {new Date(session.startedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="history-item__meta">{session.turnCount} turns · {session.status}</p>
                  </div>
                </div>
                <span className="history-item__chevron">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="history-item__detail">
                  {weaknesses.length > 0 && (
                    <div className="weakness-summary">
                      <h4 className="weakness-summary__title">💡 Improvement Areas</h4>
                      <ul className="weakness-list">
                        {weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="history-item__actions">
                    <a
                      href={`/api/interviews/mock/export/${session.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      ↓ Export Report
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InterviewHistoryPage;
