import React, { useEffect, useState } from 'react';
import { useInterview } from '../hooks/useInterview';
import type { InterviewStage } from '../types/interview';

const STAGES: InterviewStage[] = [
  'APPLIED',
  'PHONE_SCREEN',
  'TECHNICAL_TEST',
  'FIRST_INTERVIEW',
  'SECOND_INTERVIEW',
  'FINAL_ROUND',
  'OFFER',
  'REJECTED',
];

const STAGE_LABELS: Record<InterviewStage, string> = {
  APPLIED: 'Applied',
  PHONE_SCREEN: 'Phone Screen',
  TECHNICAL_TEST: 'Technical Test',
  FIRST_INTERVIEW: '1st Interview',
  SECOND_INTERVIEW: '2nd Interview',
  FINAL_ROUND: 'Final Round',
  OFFER: '🎉 Offer',
  REJECTED: 'Rejected',
};

const STAGE_COLORS: Record<InterviewStage, string> = {
  APPLIED: 'bg-gray-100 text-gray-700',
  PHONE_SCREEN: 'bg-blue-100 text-blue-700',
  TECHNICAL_TEST: 'bg-yellow-100 text-yellow-700',
  FIRST_INTERVIEW: 'bg-purple-100 text-purple-700',
  SECOND_INTERVIEW: 'bg-indigo-100 text-indigo-700',
  FINAL_ROUND: 'bg-orange-100 text-orange-700',
  OFFER: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

interface Props {
  userJobId: string;
  companyName?: string;
  roleTitle?: string;
  onStartMock?: (trackId: string) => void;
}

export const InterviewTracker: React.FC<Props> = ({
  userJobId,
  companyName,
  roleTitle,
  onStartMock,
}) => {
  const {
    track,
    kit,
    loading,
    error,
    loadTrack,
    generateKit,
    loadKit,
    updateStage,
  } = useInterview(userJobId);

  const [kitGenerated, setKitGenerated] = useState(false);
  const [generatingKit, setGeneratingKit] = useState(false);

  useEffect(() => {
    loadTrack();
  }, [loadTrack]);

  useEffect(() => {
    if (track?.id) loadKit(track.id);
  }, [track?.id, loadKit]);

  useEffect(() => {
    if (kit.length > 0) setKitGenerated(true);
  }, [kit]);

  const handleGenerateKit = async () => {
    setGeneratingKit(true);
    await generateKit();
    setGeneratingKit(false);
    setKitGenerated(true);
  };

  const handleStageChange = (stage: InterviewStage) => {
    if (track?.id) updateStage(track.id, stage);
  };

  if (loading && !track) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">
            {companyName ?? track?.companyName ?? 'Company'}
          </h3>
          <p className="text-sm text-gray-500">{roleTitle ?? track?.roleTitle ?? 'Role'}</p>
        </div>
        {track && (
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            STAGE_COLORS[track.currentStage as InterviewStage] ?? 'bg-gray-100 text-gray-600'
          }`}>
            {STAGE_LABELS[track.currentStage as InterviewStage] ?? track.currentStage}
          </span>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
      )}

      {/* Stage Progress */}
      {track && (
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Interview Stage</p>
          <div className="flex flex-wrap gap-2">
            {STAGES.filter(s => s !== 'REJECTED').map(stage => (
              <button
                key={stage}
                onClick={() => handleStageChange(stage)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  track.currentStage === stage
                    ? STAGE_COLORS[stage] + ' ring-2 ring-offset-1 ring-current'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {STAGE_LABELS[stage]}
              </button>
            ))}
            <button
              onClick={() => handleStageChange('REJECTED')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                track.currentStage === 'REJECTED'
                  ? 'bg-red-100 text-red-700 ring-2 ring-offset-1 ring-red-400'
                  : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>
      )}

      {/* Interview Kit */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800 text-sm">Interview Kit</p>
            <p className="text-xs text-gray-500">
              {kitGenerated ? `${kit.length} questions ready` : 'AI-generated questions for this role'}
            </p>
          </div>
          {!kitGenerated ? (
            <button
              onClick={handleGenerateKit}
              disabled={generatingKit}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {generatingKit ? 'Generating…' : 'Generate Kit'}
            </button>
          ) : (
            <button
              onClick={() => track && onStartMock?.(track.id)}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
            >
              Start Mock Interview
            </button>
          )}
        </div>

        {/* Question preview */}
        {kitGenerated && kit.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {kit.map((q, i) => (
              <div key={q.id} className="flex gap-3 p-2 bg-gray-50 rounded-lg">
                <span className="text-xs font-bold text-gray-400 mt-0.5 w-4 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-relaxed">{q.question}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    q.questionType === 'TECHNICAL' ? 'bg-blue-50 text-blue-600'
                    : q.questionType === 'SITUATIONAL' ? 'bg-yellow-50 text-yellow-600'
                    : 'bg-purple-50 text-purple-600'
                  }`}>
                    {q.questionType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewTracker;
