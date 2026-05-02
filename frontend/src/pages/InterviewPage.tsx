import { useEffect, useRef, useState } from 'react';
import { interviewApi } from '@/services/interviewApi';
import type { InterviewTrack } from '@/types/interview';
import MockInterview from '@/components/MockInterview';
import { Brain, ChevronRight, Clock, CheckCircle2, Trophy, RotateCcw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  category: string;
  question: string;
  idealAnswer: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface AnswerFeedback {
  score: number;
  strong: string;
  missing: string;
  tip: string;
}

interface SessionAnswer {
  question: Question;
  answer: string;
  feedback: AnswerFeedback | null;
}

type SessionView = 'tracker' | 'setup' | 'session' | 'summary';

// ─── Constants ────────────────────────────────────────────────────────────────

const ANSWER_TIME_SECONDS = 120;

const DIFF_COLOR: Record<string, string> = {
  Easy:   'bg-success-highlight text-success',
  Medium: 'bg-warning-highlight text-warning',
  Hard:   'bg-error-highlight text-error',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InterviewPage() {
  const [view, setView]           = useState<SessionView>('tracker');
  const [tracks, setTracks]       = useState<InterviewTrack[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTrack, setActive]  = useState<InterviewTrack | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex]       = useState(0);
  const [answer, setAnswer]       = useState('');
  const [feedback, setFeedback]   = useState<AnswerFeedback | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
  const [timeLeft, setTimeLeft]   = useState(ANSWER_TIME_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [feedbackReport, setFeedbackReport] = useState('');
  const [summarising, setSummarising] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load tracks ──────────────────────────────────────────────────────────

  useEffect(() => {
    interviewApi.getMyTracks()
      .then(setTracks)
      .finally(() => setLoading(false));
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setTimerActive(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  // ── Start session ────────────────────────────────────────────────────────

  async function startSession(track: InterviewTrack) {
    setActive(track);
    setView('setup');
    try {
      const bank = await interviewApi.getQuestionsForJob(track.userJobId);
      const parsed: Question[] = JSON.parse(bank.questionsJson ?? '[]');
      setQuestions(parsed);
    } catch {
      setQuestions([]);
    }
    setQIndex(0);
    setAnswer('');
    setFeedback(null);
    setSessionAnswers([]);
    setSessionScore(0);
    setFeedbackReport('');
    setView('session');
    resetTimer();
    setTimerActive(true);
  }

  function resetTimer() {
    setTimeLeft(ANSWER_TIME_SECONDS);
    setTimerActive(false);
  }

  // ── Evaluate current answer ──────────────────────────────────────────────

  async function evaluate() {
    if (!questions[qIndex]) return;
    setEvaluating(true);
    setTimerActive(false);
    try {
      const q = questions[qIndex];
      const result: AnswerFeedback = await interviewApi.evaluateAnswer({
        question: q.question,
        idealAnswer: q.idealAnswer.join(' | '),
        candidateAnswer: answer,
      });
      setFeedback(result);
    } catch {
      setFeedback({ score: 0, strong: '', missing: 'Evaluation failed.', tip: 'Try again.' });
    } finally {
      setEvaluating(false);
    }
  }

  // ── Next question ─────────────────────────────────────────────────────────

  function nextQuestion() {
    const q = questions[qIndex];
    setSessionAnswers(prev => [...prev, { question: q, answer, feedback }]);
    if (qIndex + 1 < questions.length) {
      setQIndex(i => i + 1);
      setAnswer('');
      setFeedback(null);
      resetTimer();
      setTimerActive(true);
    } else {
      finishSession([...sessionAnswers, { question: q, answer, feedback }]);
    }
  }

  // ── Finish & score session ────────────────────────────────────────────────

  async function finishSession(allAnswers: SessionAnswer[]) {
    setSummarising(true);
    setView('summary');
    try {
      const answersPayload = allAnswers.map(a => ({
        category: a.question.category,
        question: a.question.question,
        answer: a.answer,
        score: a.feedback?.score ?? 0,
      }));
      const scoreResult = await interviewApi.scoreSession({
        userJobId: activeTrack!.userJobId,
        trackId: activeTrack!.id,
        answers: answersPayload,
      });
      setSessionScore(scoreResult.sessionScore ?? 0);
      setFeedbackReport(scoreResult.feedbackMarkdown ?? '');
    } catch {
      setSessionScore(0);
      setFeedbackReport('Feedback generation failed. Please try again.');
    } finally {
      setSummarising(false);
    }
  }

  // ── Timer display ─────────────────────────────────────────────────────────

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const timerUrgent = timeLeft <= 20;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Summary screen ────────────────────────────────────────────────────────

  if (view === 'summary') {
    const scoreColor = sessionScore >= 75 ? 'text-success' : sessionScore >= 50 ? 'text-warning' : 'text-error';
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={() => setView('tracker')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6">
          <ArrowLeft size={14} /> Back to Interview Tracker
        </button>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary-highlight flex items-center justify-center">
              <Trophy size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Session Complete</h2>
              <p className="text-sm text-text-muted">{activeTrack?.roleTitle} · {activeTrack?.companyName}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-text-muted">Session Score</p>
              <p className={`text-3xl font-extrabold ${scoreColor}`}>{sessionScore}<span className="text-lg font-normal text-text-muted">/100</span></p>
            </div>
          </div>

          {summarising ? (
            <div className="flex items-center gap-3 py-8 justify-center text-text-muted">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm">Generating feedback report…</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-text">
              <div
                className="whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: feedbackReport.replace(/\n/g, '<br/>') }}
              />
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-divider">
            <h3 className="text-sm font-semibold text-text mb-3">Answer Breakdown</h3>
            <div className="space-y-3">
              {sessionAnswers.map((sa, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-offset">
                  <span className="text-xs font-medium text-text-muted w-5 mt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{sa.question.question}</p>
                    {sa.feedback && (
                      <p className="text-xs text-text-muted mt-0.5">{sa.feedback.strong}</p>
                    )}
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${
                    (sa.feedback?.score ?? 0) >= 7 ? 'text-success'
                    : (sa.feedback?.score ?? 0) >= 5 ? 'text-warning'
                    : 'text-error'
                  }`}>{sa.feedback?.score ?? 0}/10</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => activeTrack && startSession(activeTrack)}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-offset border border-border rounded-xl text-sm font-medium text-text hover:bg-surface-dynamic transition-colors"
            >
              <RotateCcw size={14} /> Retake
            </button>
            <button
              onClick={() => setView('tracker')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-text-inverse rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors"
            >
              Done <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Live session screen ───────────────────────────────────────────────────

  if (view === 'session' && questions.length > 0) {
    const q = questions[qIndex];
    const progress = ((qIndex) / questions.length) * 100;

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress bar */}
        <div className="h-1.5 bg-surface-offset rounded-full mb-6 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-medium text-text-muted">Question {qIndex + 1} / {questions.length}</span>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold border ${
            timerUrgent
              ? 'bg-error-highlight border-error/30 text-error'
              : 'bg-surface-offset border-border text-text'
          }`}>
            <Clock size={14} />
            {mins}:{secs}
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${DIFF_COLOR[q.difficulty] ?? ''}` }>
            {q.difficulty}
          </span>
        </div>

        {/* Question card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium px-2 py-0.5 bg-primary-highlight text-primary rounded-full">
              {q.category}
            </span>
          </div>
          <h2 className="text-base font-semibold text-text leading-snug">{q.question}</h2>
        </div>

        {/* Answer textarea */}
        <textarea
          className="w-full h-36 p-4 bg-surface border border-border rounded-2xl text-sm text-text placeholder:text-text-faint resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="Type your answer here… aim for clear, structured responses (STAR for behavioural questions)."
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          disabled={!!feedback || evaluating}
        />

        {/* Feedback card */}
        {feedback && (
          <div className="mt-4 bg-surface-offset border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text">Feedback</span>
              <span className={`text-lg font-extrabold ${
                feedback.score >= 7 ? 'text-success' : feedback.score >= 5 ? 'text-warning' : 'text-error'
              }`}>{feedback.score}/10</span>
            </div>
            {feedback.strong && (
              <div className="flex gap-2">
                <CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" />
                <p className="text-sm text-text">{feedback.strong}</p>
              </div>
            )}
            {feedback.missing && (
              <div className="flex gap-2">
                <span className="text-warning font-bold shrink-0 text-xs mt-0.5">△</span>
                <p className="text-sm text-text">{feedback.missing}</p>
              </div>
            )}
            {feedback.tip && (
              <div className="flex gap-2">
                <span className="text-primary font-bold shrink-0 text-xs mt-0.5">💡</span>
                <p className="text-sm text-text-muted italic">{feedback.tip}</p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-4">
          {!feedback ? (
            <button
              onClick={evaluate}
              disabled={evaluating || !answer.trim()}
              className="flex-1 py-2.5 bg-primary text-text-inverse rounded-xl text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {evaluating ? 'Evaluating…' : 'Submit Answer'}
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="flex-1 py-2.5 bg-primary text-text-inverse rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-1.5"
            >
              {qIndex + 1 < questions.length ? 'Next Question' : 'Finish Session'}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Session with no questions (fallback mock) ─────────────────────────────

  if (view === 'session' && activeTrack) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={() => setView('tracker')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <MockInterview
            userJobId={activeTrack.userJobId}
            trackId={activeTrack.id}
            onComplete={() => setView('tracker')}
          />
        </div>
      </div>
    );
  }

  // ── Tracker list ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
      <div className="flex items-center justify-between pt-2 mb-6">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Brain size={20} className="text-primary" />
            Interview Coach
          </h1>
          <p className="text-sm text-text-muted mt-1">
            AI-generated question kits and live mock interviews for every job you're pursuing.
          </p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-primary-highlight rounded-2xl flex items-center justify-center">
            <Brain size={28} className="text-primary" />
          </div>
          <p className="font-semibold text-text">No interview tracks yet</p>
          <p className="text-sm text-text-muted mt-1 mb-5">
            Open any job and click the <strong>Interview</strong> tab to generate your first kit.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-text-inverse rounded-xl font-semibold text-sm hover:bg-primary-hover transition-colors"
          >
            Browse Jobs <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tracks.map(track => (
            <div
              key={track.id}
              className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-text">{track.roleTitle ?? 'Role'}</h3>
                  <p className="text-sm text-text-muted">{track.companyName ?? 'Company'}</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                    track.currentStage === 'OFFER'      ? 'bg-success-highlight text-success'
                    : track.currentStage === 'REJECTED' ? 'bg-error-highlight text-error'
                    : track.currentStage === 'FINAL_ROUND' ? 'bg-warning-highlight text-warning'
                    : 'bg-primary-highlight text-primary'
                  }`}>
                    {track.currentStage?.replace(/_/g, ' ')}
                  </span>
                </div>
                <button
                  onClick={() => startSession(track)}
                  className="shrink-0 px-4 py-2 bg-primary text-text-inverse text-sm rounded-xl font-semibold hover:bg-primary-hover transition-colors"
                >
                  Start Interview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
