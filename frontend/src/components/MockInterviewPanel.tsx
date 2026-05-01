import React, { useEffect, useState } from 'react';
import { interviewApi } from '../services/interviewApi';
import type { InterviewQuestion, InterviewSession, AnswerResult } from '../types/interview';
import { Mic, Send, ChevronRight, Trophy, TrendingUp, AlertCircle } from 'lucide-react';

interface Props {
  userJobId: string;
  trackId: string;
  onComplete?: (score: number) => void;
  onBack?: () => void;
}

type Phase = 'intro' | 'active' | 'result' | 'finished';

export const MockInterviewPanel: React.FC<Props> = ({
  userJobId,
  trackId,
  onComplete,
  onBack,
}) => {
  const [kit, setKit]           = useState<InterviewQuestion[]>([]);
  const [session, setSession]   = useState<InterviewSession | null>(null);
  const [phase, setPhase]       = useState<Phase>('intro');
  const [index, setIndex]       = useState(0);
  const [answer, setAnswer]     = useState('');
  const [result, setResult]     = useState<AnswerResult | null>(null);
  const [results, setResults]   = useState<Map<string, AnswerResult>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const current = kit[index];
  const total   = kit.length;
  const progress = total > 0 ? (index / total) * 100 : 0;

  useEffect(() => {
    interviewApi.getKit(trackId)
      .then(setKit)
      .catch(() => setError('Failed to load questions'))
      .finally(() => setLoading(false));
  }, [trackId]);

  const handleStart = async () => {
    try {
      const s = await interviewApi.startSession(userJobId);
      setSession(s);
      setPhase('active');
    } catch {
      setError('Failed to start session');
    }
  };

  const handleSubmit = async () => {
    if (!session || !current || !answer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await interviewApi.submitAnswer(session.id, current.id, answer);
      if (res) {
        setResult(res);
        setResults(prev => new Map(prev).set(current.id, res));
        setPhase('result');
      }
    } catch {
      setError('Failed to score answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (index < total - 1) {
      setIndex(i => i + 1);
      setAnswer('');
      setResult(null);
      setPhase('active');
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!session) return;
    try {
      const completed = await interviewApi.completeSession(session.id);
      setSession(completed);
    } catch {}
    setPhase('finished');
    const scores = Array.from(results.values()).map(r => r.score);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    onComplete?.(avg);
  };

  const scoreColor = (s: number) =>
    s >= 70 ? 'text-green-600' : s >= 50 ? 'text-yellow-600' : 'text-red-500';
  const scoreBg = (s: number) =>
    s >= 70 ? 'bg-green-50 border-green-200' : s >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
    </div>
  );

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="text-center space-y-5 py-8">
      <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
        <Mic size={28} className="text-purple-600" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-900">Mock Interview</h3>
        <p className="text-sm text-slate-500 mt-1">
          {total > 0
            ? `${total} questions • Answer each and get instant AI scoring`
            : 'No questions loaded'}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-center">
        {onBack && (
          <button onClick={onBack} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-slate-300 transition-colors">
            ← Back
          </button>
        )}
        <button
          onClick={handleStart}
          disabled={total === 0}
          className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          Start Interview
        </button>
      </div>
    </div>
  );

  // ── FINISHED ───────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const scores = Array.from(results.values()).map(r => r.score);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const strong = scores.filter(s => s >= 70).length;
    const weak   = scores.filter(s => s < 50).length;
    return (
      <div className="space-y-5 py-4">
        <div className="text-center">
          <Trophy size={40} className="mx-auto text-yellow-500 mb-3" />
          <h3 className="text-2xl font-bold text-slate-900">Interview Complete!</h3>
          <div className={`text-5xl font-black mt-2 ${scoreColor(avg)}`}>
            {avg}<span className="text-xl font-normal text-slate-400">/100</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-slate-900">{total}</p>
            <p className="text-xs text-slate-500">Questions</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-700">{strong}</p>
            <p className="text-xs text-slate-500">Strong</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-red-600">{weak}</p>
            <p className="text-xs text-slate-500">Needs Work</p>
          </div>
        </div>
        <button
          onClick={() => window.open(`/api/interview/pdf/session/${session?.id}`, '_blank')}
          className="w-full py-2.5 border border-purple-200 text-purple-700 rounded-xl text-sm font-semibold hover:bg-purple-50 transition-colors"
        >
          📄 Download Interview Report (PDF)
        </button>
        {onBack && (
          <button onClick={onBack} className="w-full py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:border-slate-300 transition-colors">
            ← Back to Kit
          </button>
        )}
      </div>
    );
  }

  // ── ACTIVE + RESULT ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Question {index + 1} of {total}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Score badges row */}
      <div className="flex gap-2 flex-wrap">
        {Array.from(results.entries()).map(([qId, r], i) => (
          <span
            key={qId}
            className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold border ${
              r.score >= 70 ? 'bg-green-50 border-green-300 text-green-700'
              : r.score >= 50 ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
              : 'bg-red-50 border-red-300 text-red-600'
            }`}
            title={`Q${i + 1}: ${r.score}/100`}
          >
            {i + 1}
          </span>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
          <AlertCircle size={14} />{error}
        </div>
      )}

      {current && (
        <div className="space-y-3">
          {/* Question card */}
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                current.questionType === 'TECHNICAL'   ? 'bg-blue-100 text-blue-700'
                : current.questionType === 'SITUATIONAL' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-purple-100 text-purple-700'
              }`}>
                {current.questionType}
              </span>
              {current.skillArea && (
                <span className="text-xs text-slate-500">{current.skillArea}</span>
              )}
            </div>
            <p className="font-semibold text-slate-800 leading-relaxed">{current.question}</p>
          </div>

          {phase === 'active' ? (
            <div className="space-y-3">
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Type your answer here…"
                rows={5}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || !answer.trim()}
                className="w-full h-11 flex items-center justify-center gap-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Scoring…</>
                ) : (
                  <><Send size={14} />Submit Answer</>
                )}
              </button>
            </div>
          ) : result && (
            <div className="space-y-3">
              {/* Score card */}
              <div className={`flex items-center gap-4 border rounded-xl p-4 ${scoreBg(result.score)}`}>
                <div className={`text-4xl font-black ${scoreColor(result.score)}`}>
                  {result.score}
                  <span className="text-base font-normal text-slate-400">/100</span>
                </div>
                <p className="text-sm text-slate-700 flex-1">{result.feedback}</p>
              </div>
              {/* Strengths + Improve */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-green-700 mb-1">✅ Strengths</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{result.strengths}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-orange-700 mb-1">📈 Improve</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{result.improvements}</p>
                </div>
              </div>
              <button
                onClick={handleNext}
                className="w-full h-11 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors"
              >
                {index < total - 1 ? (
                  <>Next Question <ChevronRight size={14} /></>
                ) : (
                  <>Finish Interview <Trophy size={14} /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MockInterviewPanel;
