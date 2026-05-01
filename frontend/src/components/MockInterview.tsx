import React, { useEffect, useState } from 'react';
import { useInterview } from '../hooks/useInterview';
import type { InterviewQuestion, AnswerResult } from '../types/interview';

interface Props {
  userJobId: string;
  trackId: string;
  onComplete?: (overallScore: number) => void;
}

export const MockInterview: React.FC<Props> = ({ userJobId, trackId, onComplete }) => {
  const {
    kit,
    session,
    loading,
    error,
    loadKit,
    startSession,
    submitAnswer,
    completeSession,
  } = useInterview(userJobId);

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Map<string, AnswerResult>>(new Map());

  const currentQuestion: InterviewQuestion | undefined = kit[currentIndex];
  const totalQuestions = kit.length;
  const progress = totalQuestions > 0 ? ((currentIndex) / totalQuestions) * 100 : 0;

  useEffect(() => {
    loadKit(trackId);
  }, [trackId, loadKit]);

  const handleStart = async () => {
    await startSession();
    setStarted(true);
  };

  const handleSubmitAnswer = async () => {
    if (!session || !currentQuestion || !answer.trim()) return;
    setSubmitting(true);
    setResult(null);
    const res = await submitAnswer(session.id, currentQuestion.id, answer);
    if (res) {
      setResult(res);
      setAnsweredQuestions(prev => new Map(prev).set(currentQuestion.id, res));
    }
    setSubmitting(false);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(i => i + 1);
      setAnswer('');
      setResult(null);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!session) return;
    const completed = await completeSession(session.id);
    setFinished(true);
    if (completed?.overallScore != null) onComplete?.(completed.overallScore);
  };

  // ── Not started ───────────────────────────────────────────
  if (!started) {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="text-5xl">🎯</div>
        <h3 className="text-xl font-semibold text-gray-900">Mock Interview</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          {totalQuestions > 0
            ? `${totalQuestions} questions ready. Answer each one and get instant AI feedback and scores.`
            : 'Loading questions…'}
        </p>
        <button
          onClick={handleStart}
          disabled={loading || totalQuestions === 0}
          className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Loading…' : 'Start Mock Interview'}
        </button>
      </div>
    );
  }

  // ── Finished ─────────────────────────────────────────────
  if (finished && session) {
    const scores = Array.from(answeredQuestions.values()).map(r => r.score).filter(Boolean);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return (
      <div className="text-center space-y-6 py-6">
        <div className="text-5xl">{avg >= 70 ? '🏆' : avg >= 50 ? '📈' : '💪'}</div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Interview Complete!</h3>
          <p className="text-sm text-gray-500 mt-1">Overall Score</p>
          <p className={`text-5xl font-bold mt-2 ${
            avg >= 70 ? 'text-green-600' : avg >= 50 ? 'text-yellow-600' : 'text-red-500'
          }`}>{avg}<span className="text-xl text-gray-400">/100</span></p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-lg font-bold text-gray-900">{totalQuestions}</p>
            <p className="text-xs text-gray-500">Questions</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-lg font-bold text-green-700">{scores.filter(s => s >= 70).length}</p>
            <p className="text-xs text-gray-500">Strong (70+)</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-lg font-bold text-red-600">{scores.filter(s => s < 50).length}</p>
            <p className="text-xs text-gray-500">Needs Work</p>
          </div>
        </div>
        {session.feedbackSummary && (
          <p className="text-sm text-gray-600 bg-blue-50 rounded-xl p-4">{session.feedbackSummary}</p>
        )}
      </div>
    );
  }

  // ── In Progress ───────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
      )}

      {currentQuestion && (
        <div className="space-y-3">
          {/* Question */}
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                currentQuestion.questionType === 'TECHNICAL' ? 'bg-blue-100 text-blue-700'
                : currentQuestion.questionType === 'SITUATIONAL' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-purple-100 text-purple-700'
              }`}>
                {currentQuestion.questionType}
              </span>
              {currentQuestion.skillArea && (
                <span className="text-xs text-gray-500">{currentQuestion.skillArea}</span>
              )}
            </div>
            <p className="text-gray-800 font-medium leading-relaxed">{currentQuestion.question}</p>
          </div>

          {/* Answer Input */}
          {!result ? (
            <div className="space-y-3">
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Type your answer here…"
                rows={5}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button
                onClick={handleSubmitAnswer}
                disabled={submitting || !answer.trim()}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Scoring your answer…' : 'Submit Answer'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Score */}
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <div className={`text-3xl font-bold ${
                  result.score >= 70 ? 'text-green-600'
                  : result.score >= 50 ? 'text-yellow-600'
                  : 'text-red-500'
                }`}>
                  {result.score}
                  <span className="text-base font-normal text-gray-400">/100</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{result.feedback}</p>
                </div>
              </div>

              {/* Strengths + Improvements */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-green-700 mb-1">✅ Strengths</p>
                  <p className="text-xs text-gray-700">{result.strengths}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-orange-700 mb-1">📈 Improve</p>
                  <p className="text-xs text-gray-700">{result.improvements}</p>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
              >
                {currentIndex < totalQuestions - 1 ? 'Next Question →' : 'Finish Interview'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MockInterview;
