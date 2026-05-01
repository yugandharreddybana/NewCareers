import React, { useEffect, useState } from 'react';
import { interviewApi } from '../services/interviewApi';
import type { InterviewQuestion } from '../types/interview';
import { FileDown, RefreshCw, Brain } from 'lucide-react';

const TYPE_STYLES: Record<string, string> = {
  TECHNICAL:   'bg-blue-50 text-blue-700',
  BEHAVIOURAL: 'bg-purple-50 text-purple-700',
  SITUATIONAL: 'bg-yellow-50 text-yellow-700',
};

interface Props {
  userJobId: string;
  trackId: string;
  companyName?: string;
  roleTitle?: string;
  onStartMock?: () => void;
}

export const InterviewKitPanel: React.FC<Props> = ({
  userJobId,
  trackId,
  companyName,
  roleTitle,
  onStartMock,
}) => {
  const [kit, setKit] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!trackId) return;
    setLoading(true);
    interviewApi.getKit(trackId)
      .then(setKit)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trackId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const questions = await interviewApi.generateKit(userJobId);
      setKit(questions);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to generate kit');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    window.open(`/api/interview/pdf/${trackId}`, '_blank');
  };

  const grouped = kit.reduce<Record<string, InterviewQuestion[]>>((acc, q) => {
    const key = q.questionType ?? 'OTHER';
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Brain size={16} className="text-purple-600" />
            Interview Kit
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {companyName && roleTitle
              ? `${companyName} • ${roleTitle}`
              : 'AI-generated questions for this role'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {kit.length > 0 && (
            <>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:border-purple-300 hover:text-purple-700 transition-all"
              >
                <FileDown size={12} /> PDF
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                title="Regenerate kit"
                className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-lg text-slate-400 hover:text-purple-600 hover:border-purple-300 transition-all"
              >
                <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
      )}

      {/* Empty state */}
      {kit.length === 0 && !generating && (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
          <Brain size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-slate-700 text-sm">No questions yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Generate a tailored interview kit for this role
          </p>
          <button
            onClick={handleGenerate}
            className="px-5 py-2.5 bg-purple-600 text-white text-sm rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            Generate Kit
          </button>
        </div>
      )}

      {generating && (
        <div className="text-center py-10 border border-dashed border-purple-200 rounded-2xl bg-purple-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-purple-700">Generating your interview kit…</p>
          <p className="text-xs text-purple-500 mt-1">This takes about 30 seconds</p>
        </div>
      )}

      {/* Questions grouped by type */}
      {kit.length > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, questions]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  TYPE_STYLES[type] ?? 'bg-gray-50 text-gray-600'
                }`}>
                  {type}
                </span>
                <span className="text-xs text-slate-400">{questions.length} questions</span>
              </div>
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="border border-slate-100 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-300 mt-0.5 w-5 shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm text-slate-700 flex-1 leading-relaxed">{q.question}</p>
                      <span className="text-slate-400 text-xs shrink-0">
                        {expanded === q.id ? '▲' : '▼'}
                      </span>
                    </button>
                    {expanded === q.id && q.expectedAnswer && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Expected Answer</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{q.expectedAnswer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Start Mock CTA */}
          {onStartMock && (
            <button
              onClick={onStartMock}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors mt-2"
            >
              🎯 Start Mock Interview
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default InterviewKitPanel;
