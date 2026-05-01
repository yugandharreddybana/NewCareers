import { useEffect, useState } from 'react';
import { interviewApi } from '@/services/interviewApi';
import type { InterviewTrack } from '@/types/interview';
import MockInterview from '@/components/MockInterview';
import { Brain, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InterviewPage() {
  const [tracks, setTracks] = useState<InterviewTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMock, setActiveMock] = useState<{ userJobId: string; trackId: string } | null>(null);

  useEffect(() => {
    interviewApi.getMyTracks()
      .then(setTracks)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (activeMock) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => setActiveMock(null)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          ← Back to Interview Tracker
        </button>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <MockInterview
            userJobId={activeMock.userJobId}
            trackId={activeMock.trackId}
            onComplete={(score) => {
              setActiveMock(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Brain size={22} className="text-purple-600" />
            Interview Coach
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-generated question kits and mock interviews for every job you're pursuing.
          </p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-purple-50 rounded-2xl flex items-center justify-center">
            <Brain size={28} className="text-purple-400" />
          </div>
          <p className="font-semibold text-slate-700">No interview tracks yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">
            Open any job and click <strong>Interview</strong> tab to generate your first kit.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors"
          >
            Browse Jobs <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tracks.map(track => (
            <div
              key={track.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-purple-200 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900">{track.roleTitle ?? 'Role'}</h3>
                  <p className="text-sm text-slate-500">{track.companyName ?? 'Company'}</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                    track.currentStage === 'OFFER'    ? 'bg-green-100 text-green-700'
                  : track.currentStage === 'REJECTED' ? 'bg-red-100 text-red-700'
                  : track.currentStage === 'FINAL_ROUND' ? 'bg-orange-100 text-orange-700'
                  : 'bg-purple-100 text-purple-700'
                  }`}>
                    {track.currentStage.replace(/_/g, ' ')}
                  </span>
                </div>
                <button
                  onClick={() => setActiveMock({ userJobId: track.userJobId, trackId: track.id })}
                  className="shrink-0 px-4 py-2 bg-purple-600 text-white text-sm rounded-xl font-semibold hover:bg-purple-700 transition-colors"
                >
                  Mock Interview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
