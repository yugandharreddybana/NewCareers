/**
 * InterviewKitPanel.tsx — Phase 3.1
 *
 * Shows the AI-generated interview kit for a job.
 * Placed on JobDetail page.
 * Lets user generate kit, browse questions by skill area, and start a mock.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interviewApi } from '../../services/interviewApi';

const SKILL_COLOURS: Record<string, string> = {
  behavioural:  'bg-blue-100 text-blue-800',
  technical:    'bg-purple-100 text-purple-800',
  situational:  'bg-amber-100 text-amber-800',
  motivational: 'bg-green-100 text-green-800',
  culture:      'bg-pink-100 text-pink-800',
  general:      'bg-gray-100 text-gray-700',
};

interface Props {
  userJobId: string;
  companyName?: string;
  roleTitle?: string;
  jobDescription?: string;
  onStartMock?: (sessionId: string, firstQuestion: string, questionId: string) => void;
}

export default function InterviewKitPanel({
  userJobId, companyName, roleTitle, jobDescription, onStartMock,
}: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['interview-kit', userJobId],
    queryFn: () => interviewApi.getKit(userJobId),
  });

  const generateMutation = useMutation({
    mutationFn: () => interviewApi.generateKit(
      userJobId,
      companyName ?? '',
      roleTitle ?? '',
      jobDescription ?? ''
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interview-kit', userJobId] }),
  });

  const startMockMutation = useMutation({
    mutationFn: () => interviewApi.startMock(userJobId),
    onSuccess: (data) => onStartMock?.(data.sessionId, data.question, data.questionId),
  });

  const skillAreas = ['all', ...Array.from(new Set(questions.map(q => q.skillArea ?? 'general')))];
  const filtered = activeFilter === 'all'
    ? questions
    : questions.filter(q => (q.skillArea ?? 'general') === activeFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Interview Kit</h3>
        <div className="flex gap-2">
          {questions.length > 0 && (
            <button
              onClick={() => startMockMutation.mutate()}
              disabled={startMockMutation.isPending}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {startMockMutation.isPending ? 'Starting…' : '▶ Start Mock'}
            </button>
          )}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? 'Generating…' : questions.length > 0 ? '↻ Regenerate' : '✦ Generate Kit'}
          </button>
        </div>
      </div>

      {generateMutation.isPending && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4 text-sm text-indigo-700 animate-pulse">
          AI is building your interview kit — this takes about 10 seconds…
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading kit…</p>}

      {questions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {skillAreas.map(area => (
            <button
              key={area}
              onClick={() => setActiveFilter(area)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilter === area
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {area.charAt(0).toUpperCase() + area.slice(1)}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && !isLoading && !generateMutation.isPending && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No interview kit yet. Click Generate Kit to create one.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-gray-200 bg-white">
            <button
              className="w-full flex items-start gap-3 p-4 text-left"
              onClick={() => setExpanded(expanded === q.id ? null : q.id)}
            >
              <span className="text-gray-400 text-sm font-mono w-5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{q.question}</p>
                {q.score != null && (
                  <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                    q.score >= 7 ? 'bg-green-100 text-green-700'
                    : q.score >= 4 ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                  }`}>
                    Score: {q.score}/10
                  </span>
                )}
              </div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                SKILL_COLOURS[q.skillArea ?? 'general'] ?? SKILL_COLOURS.general
              }`}>
                {q.skillArea ?? 'general'}
              </span>
              <span className="text-gray-400 text-xs">{expanded === q.id ? '▲' : '▼'}</span>
            </button>

            {expanded === q.id && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                {q.modelAnswer && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Model Answer</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{q.modelAnswer}</p>
                  </div>
                )}
                {q.userAnswer && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your Answer</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{q.userAnswer}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
