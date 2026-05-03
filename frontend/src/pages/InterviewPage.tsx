import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { interviewApi } from '@/services/interviewApi';
import toast from 'react-hot-toast';
import { MessageSquare, Play, ChevronRight, BookOpen, Star, CheckCircle, Clock, RefreshCw } from 'lucide-react';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_TRACKS = [
  { id: 'tr-1', userJobId: 'uj-1', jobTitle: 'Senior Frontend Engineer', company: 'TechWave Ireland', stage: 'technical', questionCount: 12, sessionsCompleted: 1, avgScore: 78 },
  { id: 'tr-2', userJobId: 'uj-2', jobTitle: 'Lead Full Stack Developer', company: 'EcoGrowth', stage: 'screening', questionCount: 8, sessionsCompleted: 0, avgScore: null },
];

const MOCK_TIPS = [
  { icon: '💬', tip: 'Use the STAR method: Situation, Task, Action, Result.' },
  { icon: '⏱️', tip: 'Keep answers to 2–3 minutes. Interviewers prefer concise responses.' },
  { icon: '🔍', tip: 'Research the company’s recent news, funding, and products before your interview.' },
  { icon: '🧠', tip: 'Prepare 2–3 questions to ask the interviewer at the end.' },
];

const STAGE_COLORS: Record<string, string> = {
  screening:  'bg-blue-100 text-blue-700',
  technical:  'bg-indigo-100 text-indigo-700',
  behavioural:'bg-purple-100 text-purple-700',
  final:      'bg-emerald-100 text-emerald-700',
};

const InterviewPage: React.FC = () => {
  const [tracks, setTracks] = useState<typeof MOCK_TRACKS>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) { await new Promise(r => setTimeout(r, 400)); setTracks(MOCK_TRACKS); }
        else { const d = await interviewApi.getMyTracks().catch(() => MOCK_TRACKS as never[]); setTracks(d as typeof MOCK_TRACKS); }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleStart = async (userJobId: string) => {
    setStarting(userJobId);
    try {
      if (USE_MOCKS) { await new Promise(r => setTimeout(r, 600)); toast.success('Mock session started! (full session UI in InterviewHistory)'); return; }
      const session = await interviewApi.startSession(userJobId);
      toast.success(`Session started: ${session.id}`);
    } catch { toast.error('Failed to start session.'); }
    finally { setStarting(null); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading interview prep…</div>;

  return (
    <>
      <PageMeta title="Interview Prep — CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Interview Prep</h1>
          <p className="text-sm text-gray-500 mt-1">AI-generated question kits and mock interview sessions tailored to each job.</p>
        </div>

        {/* Active tracks */}
        {tracks.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Your Prep Tracks</h2>
            {tracks.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><MessageSquare size={17} /></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.jobTitle}</p>
                      <p className="text-xs text-gray-500">{t.company}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${STAGE_COLORS[t.stage] ?? 'bg-gray-100 text-gray-500'}`}>{t.stage}</span>
                        <span className="text-[11px] text-gray-400">{t.questionCount} questions</span>
                        {t.sessionsCompleted > 0 && <span className="text-[11px] text-gray-400">{t.sessionsCompleted} session{t.sessionsCompleted > 1 ? 's' : ''} done</span>}
                        {t.avgScore !== null && <span className="text-[11px] font-semibold text-indigo-600">{t.avgScore}% avg</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStart(t.userJobId)}
                    disabled={starting === t.userJobId}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors shrink-0">
                    {starting === t.userJobId ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                    {starting === t.userJobId ? 'Starting…' : 'Start Session'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
            <MessageSquare size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">No prep tracks yet</p>
            <p className="text-xs text-gray-400 mt-1">Open a Job Detail page and run the <strong>Interview Prep</strong> Skill to generate a question kit.</p>
          </div>
        )}

        {/* Tips */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><BookOpen size={15} className="text-indigo-500" /> Interview Tips</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MOCK_TIPS.map((t, i) => (
              <div key={i} className="bg-indigo-50 rounded-xl p-3">
                <p className="text-sm mb-1">{t.icon}</p>
                <p className="text-xs text-indigo-800">{t.tip}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
};

export default InterviewPage;
