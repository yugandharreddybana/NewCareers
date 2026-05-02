// Task 15 — MockInterviewPanel: conversational mock interview UI with live score badges
import React, { useEffect, useRef, useState } from 'react';
import axios from '../../api/axiosInstance';

interface SessionState {
  id: string;
  status: 'ACTIVE' | 'COMPLETED';
  score: number;
  turnCount: number;
  currentQuestion: string;
  transcriptJson: string;
}

interface Props {
  userJobId: string;
}

const SCORE_COLOR = (s: number) =>
  s >= 8 ? 'score-badge--high' : s >= 5 ? 'score-badge--mid' : 'score-badge--low';

export const MockInterviewPanel: React.FC<Props> = ({ userJobId }) => {
  const [session, setSession]     = useState<SessionState | null>(null);
  const [answer, setAnswer]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [starting, setStarting]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.transcriptJson]);

  const startSession = async () => {
    setStarting(true);
    setError(null);
    try {
      const r = await axios.post<SessionState>(`/interviews/mock/start/${userJobId}`);
      setSession(r.data);
    } catch {
      setError('Could not start session. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() || !session) return;
    setLoading(true);
    setError(null);
    try {
      const r = await axios.post<SessionState>(`/interviews/mock/reply/${session.id}`, { answer });
      setSession(r.data);
      setAnswer('');
    } catch {
      setError('Failed to submit answer. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (session) window.open(`/api/interviews/mock/export/${session.id}`, '_blank');
  };

  const parseTranscript = (json: string) => {
    try { return JSON.parse(json); } catch { return []; }
  };

  if (!session) return (
    <section className="mock-panel" aria-label="Mock Interview">
      <div className="mock-panel__start">
        <div className="empty-state-card empty-state-card--subtle">
          <div className="empty-state-card__icon">🎙️</div>
          <h4 className="empty-state-card__title">Mock Interview</h4>
          <p className="empty-state-card__desc">Practice answering interview questions with real-time AI scoring and feedback on each answer.</p>
          <button className="btn btn-primary" onClick={startSession} disabled={starting}>
            {starting ? 'Starting…' : 'Start Mock Interview'}
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    </section>
  );

  const transcript = parseTranscript(session.transcriptJson);

  return (
    <section className="mock-panel" aria-label="Mock Interview Session">
      <div className="mock-panel__header">
        <h3 className="mock-panel__title">🎙️ Mock Interview</h3>
        <div className="mock-panel__meta">
          <span className={`score-badge ${SCORE_COLOR(session.score)}`}>
            Score: {session.score}/10
          </span>
          <span className="mock-panel__turns">Turn {session.turnCount}/8</span>
          {session.status === 'COMPLETED' && (
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>↓ Export Report</button>
          )}
        </div>
      </div>

      <div className="mock-panel__transcript" role="log" aria-live="polite">
        {transcript.map((turn: any, i: number) => (
          <div key={i} className="mock-turn">
            <div className="mock-turn__question">
              <span className="mock-role mock-role--interviewer">Interviewer</span>
              <p>{turn.question}</p>
            </div>
            <div className="mock-turn__answer">
              <span className="mock-role mock-role--you">You</span>
              <p>{turn.answer}</p>
            </div>
            {turn.scoreData && (
              <div className="mock-turn__feedback">
                <span className={`score-badge ${SCORE_COLOR(turn.scoreData?.score || 5)}`}>
                  {turn.scoreData?.score}/10
                </span>
                {turn.scoreData?.tips?.map((tip: string, j: number) => (
                  <span key={j} className="mock-tip">💡 {tip}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {session.status === 'ACTIVE' && (
        <>
          <div className="mock-panel__question" aria-live="polite">
            <span className="mock-role mock-role--interviewer">Interviewer</span>
            <p className="mock-panel__current-q">{session.currentQuestion}</p>
          </div>
          <div className="mock-panel__input-area">
            <textarea
              className="mock-panel__textarea"
              rows={4}
              placeholder="Type your answer here…"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submitAnswer(); }}
              aria-label="Your answer"
            />
            <div className="mock-panel__input-footer">
              <span className="mock-panel__hint">Ctrl+Enter to submit</span>
              <button
                className="btn btn-primary"
                onClick={submitAnswer}
                disabled={loading || !answer.trim()}
              >
                {loading ? 'Scoring…' : 'Submit Answer'}
              </button>
            </div>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
        </>
      )}

      {session.status === 'COMPLETED' && (
        <div className="mock-panel__complete">
          <div className={`score-badge score-badge--lg ${SCORE_COLOR(session.score)}`}>
            Final Score: {session.score}/10
          </div>
          <p className="mock-panel__complete-msg">Interview complete! Download your full report to review all feedback.</p>
        </div>
      )}
    </section>
  );
};
