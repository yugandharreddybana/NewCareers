/**
 * InterviewHistoryPage.tsx — Phase 3.1
 *
 * Shows all mock interview sessions for the current user.
 * Displays session timeline, overall score, and weaknesses summary.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { interviewApi } from '../services/interviewApi';

const STAGE_COLOURS: Record<string, string> = {
  applied:          'bg-gray-100 text-gray-600',
  kit_generated:    'bg-blue-100 text-blue-700',
  mock_completed:   'bg-indigo-100 text-indigo-700',
  phone_screen:     'bg-amber-100 text-amber-700',
  technical:        'bg-purple-100 text-purple-700',
  final_round:      'bg-orange-100 text-orange-700',
  offer:            'bg-green-100 text-green-700',
  rejected:         'bg-red-100 text-red-700',
};

function ScoreBadge({ score }: { score: number | undefined }) {
  if (score == null) return null;
  const colour = score >= 7 ? 'bg-green-100 text-green-700'
    : score >= 4 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colour}`}>
      {score.toFixed(1)} / 10
    </span>
  );
}

export default function InterviewHistoryPage() {
  const [tab, setTab] = useState<'sessions' | 'tracks'>('sessions');

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['interview-history'],
    queryFn: interviewApi.historyForUser,
  });

  const { data: tracks = [], isLoading: tracksLoading } = useQuery({
    queryKey: ['interview-tracks'],
    queryFn: interviewApi.listTracks,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interview History</h1>
        <p className="text-gray-500 text-sm mt-1">
          Track your mock sessions, scores, and interview pipeline stage.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['sessions', 'tracks'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'sessions' ? 'Mock Sessions' : 'Pipeline Tracks'}
          </button>
        ))}
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="space-y-4">
          {sessionsLoading && <p className="text-sm text-gray-500">Loading sessions…</p>}
          {!sessionsLoading && sessions.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
              <p className="text-gray-400 text-sm">No mock sessions yet. Generate an interview kit on a job and start a mock.</p>
            </div>
          )}
          {sessions.map(session => (
            <div key={session.id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Session — {new Date(session.startedAt).toLocaleDateString('en-IE', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Mode: {session.mode} &middot; Status: {session.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreBadge score={session.overallScore} />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    session.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {session.status}
                  </span>
                </div>
              </div>

              {session.weaknesses && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  <p className="text-xs font-semibold text-red-600 mb-0.5">Areas to improve</p>
                  <p className="text-xs text-red-700">{session.weaknesses}</p>
                </div>
              )}
              {session.strengths && (
                <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                  <p className="text-xs font-semibold text-green-600 mb-0.5">Strengths</p>
                  <p className="text-xs text-green-700">{session.strengths}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tracks tab */}
      {tab === 'tracks' && (
        <div className="space-y-3">
          {tracksLoading && <p className="text-sm text-gray-500">Loading tracks…</p>}
          {!tracksLoading && tracks.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
              <p className="text-gray-400 text-sm">No interview tracks yet. Generate a kit on any job to create one.</p>
            </div>
          )}
          {tracks.map(track => (
            <div key={track.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {track.companyName ?? 'Unknown Company'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{track.roleTitle ?? 'Role not set'}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  STAGE_COLOURS[track.currentStage] ?? 'bg-gray-100 text-gray-600'
                }`}>
                  {track.currentStage.replace(/_/g, ' ')}
                </span>
              </div>
              {track.interviewDate && (
                <p className="mt-2 text-xs text-gray-500">
                  Interview date: {new Date(track.interviewDate).toLocaleDateString('en-IE', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
