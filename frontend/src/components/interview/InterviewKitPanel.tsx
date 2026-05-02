// Task 14 — InterviewKitPanel: shows generated interview questions on Job Detail page
import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';

interface Question {
  category: string;
  question: string;
  answerOutline: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface QuestionBank {
  id: string;
  company: string;
  roleTitle: string;
  questionsJson: string;
  generatedAt: string;
}

interface Props {
  userJobId: string;
}

const DIFFICULTY_CLASS: Record<string, string> = {
  Easy: 'badge--success',
  Medium: 'badge--warning',
  Hard: 'badge--error',
};

export const InterviewKitPanel: React.FC<Props> = ({ userJobId }) => {
  const [banks, setBanks]         = useState<QuestionBank[]>([]);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded]   = useState<Record<number, boolean>>({});
  const [error, setError]         = useState<string | null>(null);

  const fetchKit = useCallback(() => {
    setLoading(true);
    axios.get<QuestionBank[]>(`/interviews/kit/${userJobId}`)
      .then(r => setBanks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userJobId]);

  useEffect(() => { fetchKit(); }, [fetchKit]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await axios.post(`/interviews/generate-kit/${userJobId}`);
      await fetchKit();
    } catch {
      setError('Failed to generate kit. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = () => {
    window.open(`/api/interviews/kit/export/${userJobId}`, '_blank');
  };

  const parseQuestions = (json: string): Question[] => {
    try { return JSON.parse(json); } catch { return []; }
  };

  if (loading) return (
    <div className="interview-kit-panel">
      <div className="skeleton skeleton-heading" />
      {[1,2,3].map(i => <div key={i} className="skeleton skeleton-text" />)}
    </div>
  );

  return (
    <section className="interview-kit-panel" aria-label="Interview Preparation Kit">
      <div className="kit-header">
        <h3 className="kit-title">🎯 Interview Kit</h3>
        <div className="kit-actions">
          {banks.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>
              ↓ Export PDF
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : banks.length > 0 ? '↺ Regenerate' : '✦ Generate Kit'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {banks.length === 0 && !generating && (
        <div className="empty-state-card empty-state-card--subtle">
          <div className="empty-state-card__icon">📋</div>
          <h4 className="empty-state-card__title">No kit yet</h4>
          <p className="empty-state-card__desc">Generate a personalised interview kit tailored to this role and company.</p>
        </div>
      )}

      {banks.map(bank => {
        const questions = parseQuestions(bank.questionsJson);
        return (
          <div key={bank.id} className="kit-bank">
            <p className="kit-meta">{bank.company} — {bank.roleTitle}</p>
            {questions.map((q, i) => (
              <div key={i} className="kit-question">
                <button
                  className="kit-question__toggle"
                  onClick={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                  aria-expanded={!!expanded[i]}
                >
                  <span className="kit-question__text">{q.question}</span>
                  <span className={`badge ${DIFFICULTY_CLASS[q.difficulty] || ''}`}>{q.difficulty}</span>
                  <span className="kit-question__chevron">{expanded[i] ? '▲' : '▼'}</span>
                </button>
                {expanded[i] && (
                  <div className="kit-question__outline">
                    <p className="kit-category">Category: {q.category}</p>
                    <ul>
                      {q.answerOutline.map((point, j) => <li key={j}>{point}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
};
