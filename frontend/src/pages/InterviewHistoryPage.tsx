import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { interviewApi } from '@/services/interviewApi';
import { Clock, CheckCircle, Star, BarChart2, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

interface SessionSummary {
  id: string;
  jobTitle: string;
  company: string;
  startedAt: string;
  completedAt: string | null;
  totalQuestions: number;
  answeredQuestions: number;
  overallScore: number | null;
  feedback: string | null;
  answers: { question: string; answer: string; score: number | null; feedback: string | null }[];
}

const MOCK_HISTORY: SessionSummary[] = [
  {
    id: 's-1', jobTitle: 'Senior Frontend Engineer', company: 'TechWave Ireland',
    startedAt: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date(Date.now() - 86400000 + 3600000).toISOString(),
    totalQuestions: 8, answeredQuestions: 8, overallScore: 78, feedback: 'Strong technical answers. Work on conciseness in behavioural questions.',
    answers: [
      { question: 'Tell me about your experience with React hooks.', answer: 'I have used hooks extensively since React 16.8…', score: 85, feedback: 'Good depth.' },
      { question: 'Describe a time you handled a production incident.', answer: 'At my last role we had a memory leak…', score: 72, feedback: 'Could be more structured with STAR.' },
    ],
  },
  {
    id: 's-2', jobTitle: 'Lead Full Stack Developer', company: 'EcoGrowth',
    startedAt: new Date(Date.now() - 3600000 * 3).toISOString(), completedAt: null,
    totalQuestions: 10, answeredQuestions: 4, overallScore: null, feedback: null, answers: [],
  },
];

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-500';
}

const SessionCard: React.FC<{ s: SessionSummary }> = ({ s }) => {
  const [expanded, setExpanded] = useState(false);
  const completed = !!s.completedAt;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ completed ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
          <MessageSquare size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{s.jobTitle}</p>
          <p className="text-xs text-gray-500">{s.company}</p>
          <div className="flex flex-wrap gap-3 mt-1.5">
            <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={10} />{new Date(s.startedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span className="text-[11px] text-gray-400">{s.answeredQuestions}/{s.totalQuestions} answered</span>
            {s.overallScore !== null && <span className={`text-[11px] font-bold flex items-center gap-1 ${scoreColor(s.overallScore)}`}><Star size={10} />{s.overallScore}% score</span>}
            {!completed && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 text-[10px] font-bold rounded-full">In Progress</span>}
          </div>
        </div>
        {s.answers.length > 0 && (
          <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {s.feedback && (
        <div className="px-4 pb-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-blue-700 mb-0.5">AI Feedback</p>
            <p className="text-xs text-blue-800">{s.feedback}</p>
          </div>
        </div>
      )}

      {expanded && s.answers.length > 0 && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {s.answers.map((a, i) => (
            <div key={i} className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Q{i + 1}: {a.question}</p>
              <p className="text-xs text-gray-600 mb-2 italic">“{a.answer}”</p>
              <div className="flex items-center gap-3">
                {a.score !== null && <span className={`text-xs font-bold ${scoreColor(a.score)}`}>{a.score}%</span>}
                {a.feedback && <span className="text-xs text-gray-400">{a.feedback}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const InterviewHistoryPage: React.FC = () => {
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) { await new Promise(r => setTimeout(r, 400)); setHistory(MOCK_HISTORY); }
        else {
          const d = await interviewApi.getSessionHistory('all').catch(() => MOCK_HISTORY as never[]);
          setHistory(d as SessionSummary[]);
        }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading history…</div>;

  const completed  = history.filter(s => s.completedAt);
  const avgScore   = completed.filter(s => s.overallScore !== null);
  const meanScore  = avgScore.length ? Math.round(avgScore.reduce((s, h) => s + (h.overallScore ?? 0), 0) / avgScore.length) : null;

  return (
    <>
      <PageMeta title="Interview History — CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Interview History</h1>
          <p className="text-sm text-gray-500 mt-1">Review past mock sessions and AI feedback.</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Sessions',  value: history.length, icon: <MessageSquare size={15} /> },
            { label: 'Completed', value: completed.length, icon: <CheckCircle size={15} /> },
            { label: 'Avg Score', value: meanScore !== null ? `${meanScore}%` : '—', icon: <BarChart2 size={15} /> },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{s.icon}</div>
              <div><p className="text-lg font-bold text-gray-900">{s.value}</p><p className="text-[10px] text-gray-400">{s.label}</p></div>
            </div>
          ))}
        </div>

        {/* Session cards */}
        {history.length > 0
          ? <div className="space-y-4">{history.map(s => <SessionCard key={s.id} s={s} />)}</div>
          : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
              <MessageSquare size={28} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No sessions yet</p>
              <p className="text-xs text-gray-400 mt-1">Complete a mock session on the Interview Prep page to see your results here.</p>
            </div>
          )
        }
      </div>
    </>
  );
};

export default InterviewHistoryPage;
