import { useEffect, useState } from 'react';
import { interviewApi } from '@/services/interviewApi';
import type { InterviewTrack, InterviewSession } from '@/types/interview';
import { Brain, Clock, Trophy, TrendingUp, ChevronRight, FileDown } from 'lucide-react';
import { Link } from 'react-router-dom';

const STAGE_COLORS: Record<string, string> = {
  APPLIED:          'bg-gray-100 text-gray-600',
  PHONE_SCREEN:     'bg-blue-100 text-blue-700',
  TECHNICAL_TEST:   'bg-yellow-100 text-yellow-700',
  FIRST_INTERVIEW:  'bg-purple-100 text-purple-700',
  SECOND_INTERVIEW: 'bg-indigo-100 text-indigo-700',
  FINAL_ROUND:      'bg-orange-100 text-orange-700',
  OFFER:            'bg-green-100 text-green-700',
  REJECTED:         'bg-red-100 text-red-700',
};

interface TrackWithSessions {
  track: InterviewTrack;
  sessions: InterviewSession[];
}

export default function InterviewHistoryPage() {
  const [data, setData] = useState<TrackWithSessions[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    interviewApi.getMyTracks().then(async tracks => {
      const enriched = await Promise.all(
        tracks.map(async track => {
          try {
            const sessions = await interviewApi.getSessionHistory(track.userJobId);
            return { track, sessions };
          } catch {
            return { track, sessions: [] };
          }
        })
      );
      setData(enriched);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  );

  const totalSessions  = data.reduce((acc, d) => acc + d.sessions.length, 0);
  const allScores      = data.flatMap(d => d.sessions.map(s => s.overallScore).filter(Boolean) as number[]);
  const avgScore       = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
  const bestScore      = allScores.length ? Math.max(...allScores) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
      {/* Header */}
      <div className="pt-2 mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Brain size={22} className="text-purple-600" />
          Interview History
        </h1>
        <p className="text-sm text-slate-500 mt-1">Session timeline, scores, and weakness summary</p>
      </div>

      {/* Stats bar */}
      {totalSessions > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{totalSessions}</p>
            <p className="text-xs text-slate-500 mt-0.5">Sessions</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold ${
              avgScore != null && avgScore >= 70 ? 'text-green-600'
              : avgScore != null && avgScore >= 50 ? 'text-yellow-600'
              : 'text-red-500'
            }`}>{avgScore ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">Avg Score</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-purple-600">{bestScore ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">Best Score</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center">
          <Trophy size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">No interview history yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">Complete a mock interview to see your progress here.</p>
          <Link to="/interview" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors">
            Go to Interview Coach <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Timeline per track */}
      <div className="space-y-6">
        {data.filter(d => d.sessions.length > 0).map(({ track, sessions }) => (
          <div key={track.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Track header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-bold text-slate-900">{track.roleTitle ?? 'Role'}</p>
                <p className="text-sm text-slate-500">{track.companyName ?? 'Company'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                STAGE_COLORS[track.currentStage] ?? 'bg-gray-100 text-gray-600'
              }`}>
                {track.currentStage.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Sessions timeline */}
            <div className="px-5 py-4 space-y-3">
              {sessions.map((session, i) => {
                const score = session.overallScore;
                return (
                  <div key={session.id} className="flex items-start gap-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                        score != null && score >= 70 ? 'bg-green-50 border-green-300 text-green-700'
                        : score != null && score >= 50 ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                        : score != null ? 'bg-red-50 border-red-300 text-red-600'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        {i + 1}
                      </div>
                      {i < sessions.length - 1 && (
                        <div className="w-0.5 h-4 bg-slate-100 mt-1" />
                      )}
                    </div>
                    {/* Session info */}
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock size={11} />
                          {session.startedAt
                            ? new Date(session.startedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Unknown date'}
                        </div>
                        {score != null && (
                          <div className="flex items-center gap-1">
                            <TrendingUp size={11} className={score >= 70 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-400'} />
                            <span className={`text-sm font-bold ${
                              score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-500'
                            }`}>{score}/100</span>
                          </div>
                        )}
                      </div>
                      {session.feedbackSummary && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-slate-50 rounded-lg px-3 py-2">
                          {session.feedbackSummary}
                        </p>
                      )}
                      {/* PDF export per session */}
                      <button
                        onClick={() => window.open(`/api/interview/pdf/session/${session.id}`, '_blank')}
                        className="mt-2 flex items-center gap-1 text-xs text-purple-600 hover:underline"
                      >
                        <FileDown size={11} /> Download Report
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
